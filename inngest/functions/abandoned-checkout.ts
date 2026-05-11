import { inngest } from "@/inngest/client";
import { db, listings, conversions, outreachEvents, orders } from "@/db";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { shortAddress } from "@/lib/utils";

/**
 * Abandoned-checkout follow-up.
 *
 * Fires hourly. Finds listings/customers who hit Stripe checkout at
 * least N hours ago but never paid, and have never received an
 * abandoned-checkout follow-up. Sends ONE human-tone "what's blocking
 * you?" email — same pattern as a founder closer, no promo code, no
 * automation tone.
 *
 * Why this matters: the pattern that originally surfaced this was a
 * SiteGrid lead who reached Stripe checkout 9 times without paying.
 * A single direct email from the founder converts that mid-funnel
 * anxiety into either (a) a reply we can answer, or (b) a definitive
 * NO so we stop spending on the lead.
 *
 * Idempotency: outreach_events rows with templateId='abandoned_checkout'
 * are written for every send. The candidate query excludes any listing
 * with such a row. So we never re-bother the same listing.
 */
export const abandonedCheckoutFn = inngest.createFunction(
  {
    id: "abandoned-checkout",
    name: "Abandoned-checkout follow-up",
    retries: 1,
  },
  [{ cron: "0 * * * *" }, { event: "abandoned-checkout/run" }],
  async ({ step, logger }) => {
    const settings = await step.run("settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    const delayHours = Number(process.env.ABANDONED_CHECKOUT_DELAY_HOURS ?? "4");
    const perRunCap = Number(process.env.ABANDONED_CHECKOUT_MAX_PER_RUN ?? "10");
    const cutoff = new Date(Date.now() - delayHours * 3_600_000);

    // Find listings with a checkout_started conversion older than cutoff
    // that haven't already received the abandoned_checkout template AND
    // don't have a paid order.
    const candidates = await step.run("find-candidates", async () => {
      return db
        .select({
          listingId: listings.id,
          slug: listings.slug,
          address: listings.address,
          agentName: listings.agentName,
          agentEmail: listings.agentEmail,
          lastAttempt: sql<string>`max(${conversions.createdAt})`,
          attempts: sql<number>`count(${conversions.id})::int`,
        })
        .from(listings)
        .innerJoin(conversions, eq(conversions.listingId, listings.id))
        .where(
          and(
            eq(conversions.event, "checkout_started"),
            lt(conversions.createdAt, cutoff),
            sql`${listings.agentEmail} IS NOT NULL AND ${listings.agentEmail} <> ''`,
            // No prior abandoned-checkout email.
            sql`NOT EXISTS (
              SELECT 1 FROM ${outreachEvents}
              WHERE ${outreachEvents.listingId} = ${listings.id}
                AND ${outreachEvents.templateId} = 'abandoned_checkout'
            )`,
            // No paid order.
            sql`NOT EXISTS (
              SELECT 1 FROM ${orders}
              WHERE ${orders.listingId} = ${listings.id}
                AND ${orders.status} IN ('paid', 'fulfilling', 'fulfilled')
            )`,
          ),
        )
        .groupBy(
          listings.id,
          listings.slug,
          listings.address,
          listings.agentName,
          listings.agentEmail,
        )
        .orderBy(desc(sql`max(${conversions.createdAt})`))
        .limit(perRunCap);
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    const founderName = process.env.FOUNDER_NAME ?? "the founder";
    const founderReply = process.env.FOUNDER_REPLY_EMAIL ?? process.env.RESEND_REPLY_TO;
    const senderDomain = pickSenderDomain(settings.senderDomains, 0);

    for (const c of candidates) {
      if (!c.agentEmail) {
        skipped += 1;
        continue;
      }

      const firstName = (c.agentName ?? "there").split(" ")[0];
      const subject = `Anything I can answer about the ${shortAddress(c.address)} preview?`;
      const bodyText = renderBody({
        firstName,
        attempts: c.attempts,
        founderName,
      });
      const bodyMjml = `<mjml><mj-body><mj-section><mj-column>${bodyText
        .split("\n")
        .map((line) => `<mj-text font-size="15px" line-height="1.6">${escape(line)}</mj-text>`)
        .join("")}</mj-column></mj-section></mj-body></mjml>`;

      try {
        const send = await sendComplianceEmail({
          to: c.agentEmail,
          fromDomain: senderDomain,
          subject,
          mjml: bodyMjml,
          text: bodyText,
          listingId: c.listingId,
          idempotencyKey: `abandoned_${c.listingId}`,
          tags: [
            { name: "agent", value: "abandoned-checkout" },
            { name: "listing_id", value: c.listingId },
          ],
        });
        await db.insert(outreachEvents).values({
          listingId: c.listingId,
          channel: "email",
          templateId: "abandoned_checkout",
          senderDomain,
          subject,
          body: bodyText,
          resendId: send.id,
          status: "sent",
          sentAt: new Date(),
        });
        sent += 1;
      } catch (err) {
        logger.error(`abandoned-checkout listing ${c.listingId} failed`, err);
        failed += 1;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return { candidates: candidates.length, sent, skipped, failed };
  },
);

function renderBody(args: { firstName: string; attempts: number; founderName: string }): string {
  const { firstName, attempts, founderName } = args;
  return `Hi ${firstName},

I noticed you opened the checkout ${attempts > 1 ? `${attempts} times` : "earlier"} and stopped right before paying. That usually means there's a question we haven't answered, not that you're not interested.

I'd rather just ask: what's holding you up?

A few things that come up most often:
  • "How does the domain switch work without breaking the existing site?"
  • "Can I see the design on a real custom domain before I commit?"
  • "I want to tweak a few sections first."

Any of those, or something else?

If easier — happy to do a 10-min Zoom + screen-share to walk through the install side-by-side. Nothing on the live site changes until you say go.

Just hit reply with what's on your mind.

— ${founderName}
`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
