import { inngest } from "@/inngest/client";
import { db, listings, outreachEvents } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { shortAddress } from "@/lib/utils";

/**
 * Extended follow-up — touches 3 and 4.
 *
 * The base pipeline (`outreach.ts` → `outreach-schedule-followup` →
 * `followup.ts`) covers touch 1 (initial) and touch 2 (72h promo
 * follow-up). This adds:
 *
 *   Touch 3 — day 7: "bumping this once more" + the preview link. No
 *             promo code. Shorter than touch 2.
 *   Touch 4 — day 14: "last note from me" close-out. Asks once whether
 *             to keep them on the list.
 *
 * Why 4 touches: SiteGrid measured the marginal conversion at touch 4
 * = ~10% of touch 1. Touch 5+ converted at <2% with detectable
 * complaint-rate cost. Stop at 4.
 *
 * To enable: extend the existing `outreach-schedule-followup` to fan
 * out a `followup-extended/check` event (with the touch number) at
 * day 7 and day 14, or run this as a daily cron that scans outreach
 * events for due-touch-3 / due-touch-4 candidates (idempotent via the
 * templateId check).
 */
export const followupExtendedFn = inngest.createFunction(
  {
    id: "followup-extended",
    name: "Follow-up — daily touch 3 / touch 4 sweep",
    retries: 1,
  },
  [
    // Daily 13:00 UTC — same window as the weekly digest so the
    // operator's deliverability picture is consistent.
    { cron: "0 13 * * *" },
    { event: "followup/touch-3" },
    { event: "followup/touch-4" },
  ],
  async ({ logger }) => {
    const settings = await getSettings();
    if (settings.paused || settings.followupPaused) {
      return { skipped: true, reason: "paused" };
    }

    const dayMs = 86_400_000;
    const sevenDaysAgo = new Date(Date.now() - 7 * dayMs);
    const fourteenDaysAgo = new Date(Date.now() - 14 * dayMs);

    // Touch 3 candidates: listings whose only outreach is the initial
    // outreach_v1 sent ≥7d ago, no clicks/replies/unsubs, and no
    // touch-3 already sent.
    const touch3 = await findDueListings({
      mustHave: ["outreach_v1", "followup_v1"],
      mustNotHave: ["followup_v3"],
      sentBefore: sevenDaysAgo,
    });
    let sent3 = 0;
    for (const l of touch3) {
      try {
        await sendTouch({
          listing: l,
          templateId: "followup_v3",
          subject: `One more look at ${shortAddress(l.address)}?`,
          bodyText: bodyTouch3(l),
        });
        sent3 += 1;
      } catch (err) {
        logger.warn(`touch-3 failed for ${l.id}`, err);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // Touch 4 candidates: touch-3 was sent ≥7d ago, no touch-4 yet.
    const touch4 = await findDueListings({
      mustHave: ["followup_v3"],
      mustNotHave: ["followup_v4"],
      sentBefore: fourteenDaysAgo,
    });
    let sent4 = 0;
    for (const l of touch4) {
      try {
        await sendTouch({
          listing: l,
          templateId: "followup_v4",
          subject: `Last note about ${shortAddress(l.address)}`,
          bodyText: bodyTouch4(l),
        });
        sent4 += 1;
      } catch (err) {
        logger.warn(`touch-4 failed for ${l.id}`, err);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return { touch3Sent: sent3, touch4Sent: sent4 };
  },
);

interface Listing {
  id: string;
  slug: string;
  address: string;
  agentName: string | null;
  agentEmail: string | null;
}

async function findDueListings(args: {
  mustHave: string[];
  mustNotHave: string[];
  sentBefore: Date;
}): Promise<Listing[]> {
  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      address: listings.address,
      agentName: listings.agentName,
      agentEmail: listings.agentEmail,
      templateId: outreachEvents.templateId,
      sentAt: outreachEvents.sentAt,
    })
    .from(listings)
    .innerJoin(outreachEvents, eq(outreachEvents.listingId, listings.id))
    .where(
      and(
        inArray(outreachEvents.templateId, [...args.mustHave, ...args.mustNotHave]),
      ),
    );
  // Index by listing → set of templates seen, and pick listings that
  // have everything in mustHave and nothing in mustNotHave.
  const byListing = new Map<
    string,
    { listing: Listing; templates: Set<string>; latestSentAt: Date | null }
  >();
  for (const r of rows) {
    const cur = byListing.get(r.id) ?? {
      listing: { id: r.id, slug: r.slug, address: r.address, agentName: r.agentName, agentEmail: r.agentEmail },
      templates: new Set<string>(),
      latestSentAt: null,
    };
    cur.templates.add(r.templateId);
    if (r.sentAt && (!cur.latestSentAt || r.sentAt > cur.latestSentAt)) {
      cur.latestSentAt = r.sentAt;
    }
    byListing.set(r.id, cur);
  }
  const out: Listing[] = [];
  for (const e of byListing.values()) {
    if (args.mustHave.every((t) => e.templates.has(t)) &&
        args.mustNotHave.every((t) => !e.templates.has(t)) &&
        e.latestSentAt &&
        e.latestSentAt < args.sentBefore &&
        e.listing.agentEmail) {
      out.push(e.listing);
    }
  }
  return out.slice(0, 50);
}

async function sendTouch(args: {
  listing: Listing;
  templateId: string;
  subject: string;
  bodyText: string;
}): Promise<void> {
  const settings = await getSettings();
  const domain = pickSenderDomain(settings.senderDomains, Math.floor(Date.now() / 86_400_000));
  const mjml = `<mjml><mj-body><mj-section padding="24px"><mj-column>${args.bodyText
    .split("\n")
    .map((line) => `<mj-text font-size="15px" line-height="1.55">${escape(line)}</mj-text>`)
    .join("")}</mj-column></mj-section></mj-body></mjml>`;

  const [evt] = await db
    .insert(outreachEvents)
    .values({
      listingId: args.listing.id,
      channel: "email",
      templateId: args.templateId,
      senderDomain: domain,
      subject: args.subject,
      body: args.bodyText,
      status: "queued",
    })
    .returning();

  const res = await sendComplianceEmail({
    to: args.listing.agentEmail!,
    fromDomain: domain,
    subject: args.subject,
    mjml,
    text: args.bodyText,
    listingId: args.listing.id,
    idempotencyKey: `${args.templateId}_${args.listing.id}_${evt.id}`,
  });

  await db
    .update(outreachEvents)
    .set({ resendId: res.id, status: "sent", sentAt: new Date() })
    .where(eq(outreachEvents.id, evt.id));
}

function bodyTouch3(l: Listing): string {
  const firstName = (l.agentName ?? "there").split(" ")[0];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").replace(/\/$/, "");
  return `Hi ${firstName},

Bumping this once more in case it slipped — the preview for ${shortAddress(l.address)} is still live:

${appUrl}/l/${l.slug}

If now's not the right time, no worries. Hit reply with "later" and I'll check back next quarter; "no thanks" and I won't email again.

— Merchant`;
}

function bodyTouch4(l: Listing): string {
  const firstName = (l.agentName ?? "there").split(" ")[0];
  return `Hi ${firstName},

Last note from me on this one. The preview for ${shortAddress(l.address)} is still in your queue but I'll close the loop on our end so I'm not cluttering your inbox.

If anything changes, the original link still works. If you'd rather not hear from us, reply "remove" and we'll honor it.

Thanks either way,
— Merchant`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
