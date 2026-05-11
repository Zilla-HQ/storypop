import { inngest } from "@/inngest/client";
import { db, listings, orders, outreachEvents } from "@/db";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { trackEvent } from "@/lib/posthog";

/**
 * StoryPop abandoned-cart sweep. Hourly cron. Finds books where:
 *   - the preview was generated (book.story is set)
 *   - there's no paid order
 *   - the abandoned-cart email hasn't fired yet
 *   - the preview is between 22 and 72 hours old (~ next day)
 *
 * Fires a Pip-voiced "your draft is still here" email. One per book ever.
 *
 * Why the 22–72h window: under 22h is too soon (people genuinely come back
 * to think it over); over 72h converts <0.5% and accumulates complaints.
 *
 * Compliance: only sends to buyers who provided their email on /create
 * (implicit transactional consent for the product they started). CAN-SPAM
 * footer auto-injected by lib/resend.ts.
 */

export const abandonedCartFn = inngest.createFunction(
  {
    id: "abandoned-cart",
    name: "StoryPop — abandoned-cart follow-up",
    retries: 1,
    concurrency: { limit: 4 },
  },
  [{ cron: "0 * * * *" }, { event: "abandoned-cart/run" }],
  async ({ step, logger }) => {
    const candidates = await step.run("find-candidates", async () => {
      const cutoffOld = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const cutoffYoung = new Date(Date.now() - 22 * 60 * 60 * 1000);

      const rows = await db
        .select({ book: listings })
        .from(listings)
        .leftJoin(orders, eq(orders.listingId, listings.id))
        .leftJoin(
          outreachEvents,
          and(
            eq(outreachEvents.listingId, listings.id),
            eq(outreachEvents.kind, "abandoned-cart"),
          ),
        )
        .where(
          and(
            sql`${listings.story} is not null`,
            isNull(outreachEvents.id),
            isNull(orders.id),
            lte(listings.createdAt, cutoffYoung),
            sql`${listings.createdAt} >= ${cutoffOld}`,
            sql`${listings.primaryContactEmail} is not null`,
          ),
        )
        .limit(200);
      return rows.map((r) => r.book);
    });

    if (candidates.length === 0) {
      return { skipped: "no-candidates" };
    }

    let sent = 0;
    for (const book of candidates) {
      try {
        const story = book.story as { title: string } | null;
        const subject = `${book.childName}'s book is still in my draft folder`;

        const mjml = abandonedCartMjml({
          childName: book.childName,
          bookId: book.id,
          title: story?.title ?? `${book.childName}'s Book`,
        });
        const text = abandonedCartText({
          childName: book.childName,
          bookId: book.id,
          title: story?.title ?? `${book.childName}'s Book`,
        });

        await step.run(`send-${book.id}`, () =>
          sendComplianceEmail({
            to: book.primaryContactEmail ?? "",
            fromDomain: "mail.storypop.shop",
            subject,
            mjml,
            text,
            listingId: book.id,
            idempotencyKey: `abandoned-cart-${book.id}`,
          }),
        );

        await step.run(`log-${book.id}`, async () => {
          await db.insert(outreachEvents).values({
            listingId: book.id,
            channel: "email",
            templateId: "abandoned-cart-v1",
            kind: "abandoned-cart",
            subject,
            sentAt: new Date(),
            status: "sent",
          });
          await trackEvent({
            distinctId: book.id,
            event: "abandoned_cart_sent",
            properties: { bookId: book.id },
          });
        });

        sent++;
      } catch (err) {
        logger.error(
          { bookId: book.id, err: err instanceof Error ? err.message : String(err) },
          "abandoned-cart: per-book error",
        );
      }
    }

    return { candidates: candidates.length, sent };
  },
);

function publicBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://storypop.shop";
}

function abandonedCartMjml(args: { childName: string; bookId: string; title: string }): string {
  const previewUrl = `${publicBaseUrl()}/preview/${args.bookId}`;
  return `<mjml><mj-body><mj-section><mj-column><mj-text>
<p>Hi —</p>
<p>${args.childName}'s book is still in my draft folder. Pages 1, 2, and 3 are done.</p>
<p>I'll hold the draft for another seven days in case you want the rest.</p>
<p><a href="${previewUrl}">See the preview again</a></p>
<p>— Pip</p>
</mj-text></mj-column></mj-section></mj-body></mjml>`;
}

function abandonedCartText(args: { childName: string; bookId: string; title: string }): string {
  return [
    "Hi —",
    "",
    `${args.childName}'s book is still in my draft folder. Pages 1, 2, and 3 are done.`,
    "",
    "I'll hold the draft for another seven days in case you want the rest.",
    "",
    `See the preview again: ${publicBaseUrl()}/preview/${args.bookId}`,
    "",
    "— Pip",
  ].join("\n");
}
