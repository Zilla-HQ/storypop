import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { eq, isNull, and, sql } from "drizzle-orm";
import { skiptrace } from "@/lib/skiptrace";
import { getSettings } from "@/db/settings";
import { env } from "@/lib/env";

/**
 * Manual-only re-enrichment of the no-email-yet listing backlog.
 *
 * Why: 40-60% of cold leads start without an agent email (Apify scrape
 * returned only a name + listing). Without follow-up enrichment, those leads
 * never get outreach and revenue dies on the floor.
 *
 * Idempotent: skips listings that already have an email. Per-run cap
 * (BACKFILL_EMAILS_MAX_PER_RUN, default 100) keeps Hunter / Apollo quota
 * usage predictable. Re-trigger as often as needed until the backlog is empty.
 *
 * Triggered manually:
 *   - From /admin/contacts UI ("Backfill missing emails" button)
 *   - Via inngest CLI / dev UI
 *   - Programmatically: inngest.send({ name: "backfill-emails/run" })
 *
 * NOT scheduled — running this on a cron will exhaust Hunter quota.
 */
export const backfillEmailsFn = inngest.createFunction(
  {
    id: "backfill-emails",
    name: "Manual — re-enrich the no-email-yet listing backlog",
    retries: 1,
  },
  { event: "backfill-emails/run" },
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    const cap = Number(env("BACKFILL_EMAILS_MAX_PER_RUN", "100"));

    const missing = await step.run("find-missing-emails", () =>
      db
        .select()
        .from(listings)
        .where(and(
          isNull(listings.agentEmail),
          sql`${listings.agentName} IS NOT NULL`,
        ))
        .limit(cap),
    );

    logger.info(`[backfill-emails] ${missing.length} candidates (cap=${cap})`);

    let enriched = 0;
    let attempted = 0;
    let alreadyHadEmail = 0;

    for (const l of missing) {
      attempted++;
      // Race-safe: re-check we still don't have an email (another run may have
      // landed one between the SELECT above and this iteration).
      const fresh = await step.run(`recheck-${l.id}`, async () => {
        const [r] = await db.select({ agentEmail: listings.agentEmail }).from(listings).where(eq(listings.id, l.id)).limit(1);
        return r;
      });
      if (fresh?.agentEmail) {
        alreadyHadEmail++;
        continue;
      }

      const result = await step.run(`skiptrace-${l.id}`, () =>
        skiptrace({
          firstName: extractFirst(l.agentName ?? ""),
          lastName: extractLast(l.agentName ?? ""),
          fullName: l.agentName ?? null,
          city: l.city ?? "",
          state: l.state ?? "",
          zip: l.zip ?? "",
        }),
      );

      if (result.email) {
        await step.run(`save-${l.id}`, async () => {
          await db
            .update(listings)
            .set({ agentEmail: result.email })
            .where(eq(listings.id, l.id));
        });
        enriched++;
        logger.info(`[backfill-emails] ${l.id} → ${result.email} (${result.source}, ${result.confidence})`);
      }
    }

    return { attempted, enriched, alreadyHadEmail, capped: missing.length === cap };
  },
);

function extractFirst(name: string): string {
  return name.split(/\s+/)[0] ?? "";
}
function extractLast(name: string): string {
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}
