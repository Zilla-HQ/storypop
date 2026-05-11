import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { db, listings, outreachEvents } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { shortAddress, formatCents } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";

/**
 * Agent 6 — Follow-up
 * Triggered 72h after an outreach/sent. Sends ONE follow-up if the prior email
 * is still in {queued,sent,delivered,opened} (i.e., no click/reply/paid/unsub).
 * Includes a 20% discount code with 48h expiry.
 *
 * Per spec: no third touch ever.
 */
export const followupFn = inngest.createFunction(
  {
    id: "followup",
    name: "Agent 6 — Follow-up",
    retries: 2,
  },
  { event: "followup/check" },
  async ({ event, step, logger }) => {
    const { listingId, outreachEventId } = event.data;

    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.followupPaused) {
      return { skipped: true, reason: "paused" };
    }

    const original = await step.run("load-original-outreach", async () => {
      const [row] = await db
        .select()
        .from(outreachEvents)
        .where(eq(outreachEvents.id, outreachEventId))
        .limit(1);
      return row;
    });

    if (!original) return { skipped: true, reason: "original outreach missing" };

    const convertedOrSilenced: Array<typeof original.status> = [
      "clicked",
      "replied",
      "bounced",
      "complained",
      "unsubscribed",
    ];
    if (convertedOrSilenced.includes(original.status)) {
      return { skipped: true, reason: `already ${original.status}` };
    }

    // Check if any follow-up already exists — idempotency guard.
    const existingFollowups = await step.run("check-prior-followup", async () => {
      return db
        .select()
        .from(outreachEvents)
        .where(
          and(
            eq(outreachEvents.listingId, listingId),
            inArray(outreachEvents.templateId, ["followup_v1"]),
          ),
        );
    });
    if (existingFollowups.length > 0) {
      return { skipped: true, reason: "followup already sent" };
    }

    const listing = await step.run("load-listing", async () => {
      const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      return row;
    });
    if (!listing || !listing.agentEmail) return { skipped: true, reason: "no agent email" };

    const appUrl = env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
    const checkoutLink = `${appUrl}/l/${listing.slug}?code=RELIST20`;
    const firstName = (listing.agentName ?? "there").split(" ")[0];

    const subject = `Still up for it? 20% off for ${shortAddress(listing.address)}`;
    const bodyText = `Hey ${firstName},

No pressure — but RELIST20 gets you 20% off for the next 48 hours on your listing at ${shortAddress(listing.address)}.

${formatCents(settings.pricingStandardCents)} → ${formatCents(Math.round(settings.pricingStandardCents * 0.8))} with code RELIST20.

${checkoutLink}

— Realscale`;

    const mjml = `<mjml><mj-body>
      <mj-section padding="24px"><mj-column>
        <mj-text font-size="15px" line-height="1.55">Hey ${firstName},</mj-text>
        <mj-text font-size="15px" line-height="1.55">No pressure — but <b>RELIST20</b> gets you 20% off for the next 48 hours on your listing at <b>${shortAddress(listing.address)}</b>.</mj-text>
        <mj-text font-size="15px" line-height="1.55">${formatCents(settings.pricingStandardCents)} → <b>${formatCents(Math.round(settings.pricingStandardCents * 0.8))}</b> with code <b>RELIST20</b>.</mj-text>
        <mj-button href="${checkoutLink}" background-color="#111827" color="#ffffff" border-radius="8px">Claim 20% off</mj-button>
        <mj-text font-size="15px" color="#64748b">— Realscale</mj-text>
      </mj-column></mj-section>
    </mj-body></mjml>`;

    const domain = pickSenderDomain(settings.senderDomains, Math.floor(Date.now() / 86_400_000));

    const [evt] = await step.run("pre-insert-followup", async () => {
      return db
        .insert(outreachEvents)
        .values({
          listingId,
          channel: "email",
          templateId: "followup_v1",
          senderDomain: domain,
          subject,
          body: bodyText,
          status: "queued",
        })
        .returning();
    });

    const res = await step.run("send-followup", () =>
      sendComplianceEmail({
        to: listing.agentEmail!,
        fromDomain: domain,
        subject,
        mjml,
        text: bodyText,
        listingId: listing.id,
        idempotencyKey: `followup_${listingId}_${evt.id}`,
      }),
    );

    await step.run("finalize-followup", async () => {
      await db
        .update(outreachEvents)
        .set({ resendId: res.id, status: "sent", sentAt: new Date() })
        .where(eq(outreachEvents.id, evt.id));
    });

    await trackEvent({
      distinctId: listingId,
      event: "followup_sent",
      properties: { outreach_event_id: evt.id, resend_id: res.id },
    });

    logger.info(`Followup sent for listing ${listingId} (event ${evt.id})`);
    return { outreachEventId: evt.id };
  },
);
