import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { db, listings, previews, outreachEvents } from "@/db";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { draftOutreachEmail } from "@/lib/claude";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { shortAddress, formatCents } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";
import { getService } from "@/lib/services";
import { checkOptOut } from "@/lib/state-optout";

const HOMEOWNER_SOURCES = new Set(["attom", "propertyradar"]);

const COMPLAINT_RATE_ALERT_THRESHOLD = 0.05; // 5% — volume mode; the
// per-domain reputation safety net is still on (Resend marks bad senders
// regardless), but the in-app kill switch only halts on serious abuse.

/**
 * Agent 4 — Outreach
 * Drafts + sends a personalized email per qualified listing.
 */
export const outreachFn = inngest.createFunction(
  {
    id: "outreach",
    name: "Agent 4 — Outreach",
    retries: 2,
    concurrency: { limit: 5 },
  },
  // Wait for a real personalized preview before sending. Truthful emails
  // are more important than per-email cost optimization — every cold
  // email ships with a real before (the listing's own photo) + real
  // after (fal.ai-generated enhancement OF that exact photo).
  { event: "preview/ready" },
  async ({ event, step, logger }) => {
    const { listingId, previewId } = event.data;

    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.outreachPaused) {
      return { skipped: true, reason: "paused" };
    }

    // Daily cap — count emails sent today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [{ sentToday }] = await step.run("count-sent-today", async () => {
      const rows = await db
        .select({ sentToday: count() })
        .from(outreachEvents)
        .where(
          and(
            eq(outreachEvents.channel, "email"),
            gte(outreachEvents.createdAt, todayStart),
          ),
        );
      return rows;
    });

    if (sentToday >= settings.dailySendCap) {
      logger.warn(`Daily send cap reached: ${sentToday}`);
      return { skipped: true, reason: "daily send cap" };
    }

    // Deliverability kill-switch: if complaint rate in last 24h > 0.3%, halt.
    const complaintRate = await step.run("check-complaint-rate", async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [rows] = await db
        .select({
          total: count(),
          complaints: sql<number>`sum(case when status = 'complained' then 1 else 0 end)`,
        })
        .from(outreachEvents)
        .where(and(eq(outreachEvents.channel, "email"), gte(outreachEvents.createdAt, since)));
      const total = Number(rows.total ?? 0);
      const complaints = Number(rows.complaints ?? 0);
      return total > 50 ? complaints / total : 0;
    });
    if (complaintRate > COMPLAINT_RATE_ALERT_THRESHOLD) {
      logger.error(`HALT: complaint rate ${complaintRate} exceeds threshold`);
      return { skipped: true, reason: "complaint rate threshold" };
    }

    const listing = await step.run("load-listing", async () => {
      const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      return row;
    });
    if (!listing) {
      return { skipped: true, reason: "listing missing" };
    }
    // Skip outreach for self-serve submissions — the user is already on site.
    if ((listing.qualificationReason ?? "").startsWith("self-serve")) {
      return { skipped: true, reason: "self-serve (no outreach needed)" };
    }
    if (!listing.agentEmail) {
      return { skipped: true, reason: "no agent email" };
    }
    if (settings.emailBlacklist.includes(listing.agentEmail.toLowerCase())) {
      return { skipped: true, reason: "blacklisted" };
    }

    const isHomeowner = HOMEOWNER_SOURCES.has(listing.source);

    // Homeowners face stricter consumer-privacy rules (CCPA / CPA). Run the
    // opt-out check before any cold send.
    if (isHomeowner) {
      const opt = await step.run("check-optout", () =>
        checkOptOut({ email: listing.agentEmail!, state: listing.state }),
      );
      if (!opt.allowed) {
        return { skipped: true, reason: `opt-out: ${opt.reason}` };
      }
    }

    // Truthful before/after — load the personalized preview row and use
    // its real listing photo as "before" and its fal.ai-generated
    // enhancement as "after". Both images must be OF the listing.
    const [preview] = await db
      .select()
      .from(previews)
      .where(eq(previews.id, previewId))
      .limit(1);
    if (
      !preview ||
      !preview.originalPhotoUrls?.[0] ||
      !preview.enhancedPhotoUrls?.[0]
    ) {
      return { skipped: true, reason: "preview missing real before/after pair" };
    }

    // Stable image proxy URLs — re-sign R2 keys at request time so images
    // never expire. Direct R2 signed URLs go stale after 7 days, breaking
    // older emails. /api/img/<previewId> 302s to a freshly-signed URL.
    const appUrlForImg = env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
    const beforeUrl = `${appUrlForImg}/api/img/${preview.id}?i=0&kind=before`;
    const afterUrl = `${appUrlForImg}/api/img/${preview.id}?i=0&kind=after`;
    const service = getService(preview.serviceId);

    const appUrl = env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
    // Pre-apply the active launch promo on every cold-email link. The
    // /l page renders the discount banner with strike-through pricing
    // for any recognized code. Default = LAUNCH50 (50% off, the most
    // aggressive active promo) so first-touch recipients see the
    // strongest offer immediately. Stripe is source of truth at
    // checkout; unknown codes silently no-op.
    const promoCode = env("OUTREACH_PROMO_CODE", "LAUNCH50")!;
    const utm = "utm_source=email&utm_campaign=cold_outreach";
    const checkoutLink = isHomeowner
      ? `${appUrl}/l/${listing.slug}?service=${preview.serviceId}&code=${promoCode}&${utm}`
      : `${appUrl}/l/${listing.slug}?code=${promoCode}&${utm}`;
    const agentFirstName = (listing.agentName ?? "there").split(" ")[0];

    const email = isHomeowner
      ? buildHomeownerEmail({
          firstName: agentFirstName,
          shortAddress: shortAddress(listing.address),
          serviceName: service?.name ?? preview.serviceId,
          serviceNoun: service?.name?.toLowerCase() ?? preview.serviceId,
          beforeUrl,
          afterUrl,
          mockupLink: checkoutLink,
        })
      : await step.run("draft-email", () =>
          draftOutreachEmail({
            agentFirstName,
            shortAddress: shortAddress(listing.address),
            photoCount: listing.photos.length,
            checkoutLink,
            beforeUrl,
            afterUrl,
            price: formatCents(settings.pricingStandardCents),
          }),
        );

    const domain = pickSenderDomain(settings.senderDomains, sentToday);

    // Pre-insert the event row so we can link the resend_id to it after send.
    const [evtRow] = await step.run("pre-insert-outreach", async () => {
      return db
        .insert(outreachEvents)
        .values({
          listingId,
          channel: "email",
          templateId: isHomeowner ? "homeowner_outreach_v1" : "outreach_v1",
          senderDomain: domain,
          subject: email.subject,
          body: email.bodyText,
          status: "queued",
        })
        .returning();
    });

    const sendResult = await step.run("send-via-resend", async () => {
      const r = await sendComplianceEmail({
        to: listing.agentEmail!,
        fromDomain: domain,
        subject: email.subject,
        mjml: email.bodyMjml,
        text: email.bodyText,
        listingId: listing.id,
        idempotencyKey: `outreach_${listingId}_${evtRow.id}`,
        tags: [
          { name: "agent", value: "outreach" },
          { name: "listing_id", value: listingId },
        ],
      });
      return r;
    });

    await step.run("finalize-outreach-event", async () => {
      await db
        .update(outreachEvents)
        .set({
          resendId: sendResult.id,
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(outreachEvents.id, evtRow.id));
    });

    await trackEvent({
      distinctId: listingId,
      event: "outreach_sent",
      properties: {
        resend_id: sendResult.id,
        sender_domain: domain,
        outreach_event_id: evtRow.id,
      },
    });

    // Schedule a follow-up check in 72h.
    await step.sendEvent("emit-outreach-sent", {
      name: "outreach/sent",
      data: { listingId, outreachEventId: evtRow.id },
    });

    return { outreachEventId: evtRow.id, resendId: sendResult.id };
  },
);

/**
 * Homeowner cold-outreach email template. No LLM — short, concrete,
 * personalized by service. The personalization is the AI mockup of the
 * homeowner's actual property, which the body links to.
 */
function buildHomeownerEmail(args: {
  firstName: string;
  shortAddress: string;
  serviceName: string;
  serviceNoun: string;
  beforeUrl: string;
  afterUrl: string;
  mockupLink: string;
}): { subject: string; bodyText: string; bodyMjml: string } {
  const subject = `Your home at ${args.shortAddress}, with a ${args.serviceNoun}`;
  const bodyText = `Hi ${args.firstName},

We took a satellite view of your home at ${args.shortAddress} and rendered what it would look like with ${args.serviceName.toLowerCase()} — see the before/after below.

If you like it, we'll connect you (free) with the top-rated local contractors for that kind of project. They reach out within 24-48 hours with quotes — no obligation, no pressure.

${args.mockupLink}

— Realscale`;
  const bodyMjml = `<mjml><mj-body background-color="#f4f5f7">
    <mj-section padding="24px 0 8px"><mj-column>
      <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="32px 32px 8px" border-radius="14px 14px 0 0"><mj-column>
      <mj-text font-size="16px" line-height="1.6">Hi ${escapeHtml(args.firstName)},</mj-text>
      <mj-text font-size="16px" line-height="1.6">We took a satellite view of your home at <b>${escapeHtml(args.shortAddress)}</b> and rendered what it would look like with ${escapeHtml(args.serviceName.toLowerCase())} — see the before/after below.</mj-text>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="8px 16px 0">
      <mj-column padding="0 6px">
        <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">BEFORE</mj-text>
        <mj-image src="${args.beforeUrl}" alt="Before" border-radius="10px" padding="0"/>
      </mj-column>
      <mj-column padding="0 6px">
        <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#047857" padding="0 0 6px">WITH ${escapeHtml(args.serviceName.toUpperCase())}</mj-text>
        <mj-image src="${args.afterUrl}" alt="After" border-radius="10px" padding="0"/>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="20px 32px 12px"><mj-column>
      <mj-text font-size="15px" line-height="1.6">If you like it, we'll connect you (free) with the top-rated local contractors. They reach out within 24-48 hours with quotes — no obligation, no pressure.</mj-text>
      <mj-button href="${args.mockupLink}" background-color="#111827" color="#ffffff" font-size="15px" font-weight="600" padding="6px 0 4px" inner-padding="14px 28px" border-radius="8px" align="left">See the full mockup →</mj-button>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
      <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
      <mj-text font-size="12px" color="#64748b" line-height="1.6">
        ✓ Mockup yours to keep — no signup required<br/>
        ✓ Contractors are vetted, licensed, and insured<br/>
        ✓ We don't sell your info, ever
      </mj-text>
    </mj-column></mj-section>
  </mj-body></mjml>`;
  return { subject, bodyText, bodyMjml };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Fans out a 72h-delayed event to the followup agent after every outreach.
 * Separate function so the delay is durable and visible in Inngest.
 */
export const outreachScheduleFollowupFn = inngest.createFunction(
  { id: "outreach-schedule-followup", name: "Outreach — schedule 72h follow-up" },
  { event: "outreach/sent" },
  async ({ event, step }) => {
    const { listingId, outreachEventId } = event.data;
    await step.sleep("wait-72h", "72h");
    await step.sendEvent("fire-followup-check", {
      name: "followup/check",
      data: { listingId, outreachEventId },
    });
    return { scheduled: true };
  },
);
