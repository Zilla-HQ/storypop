import { inngest } from "@/inngest/client";
import { db, listings, previews } from "@/db";
import { and, eq, lt, notInArray, sql } from "drizzle-orm";
import { sendOperatorAlert } from "@/lib/operator-alerts";
import { env } from "@/lib/env";

/**
 * Watchdog cron — every 5 minutes, scan for self-serve listings older
 * than `STUCK_THRESHOLD_MIN` minutes that don't have a preview yet.
 *
 * For each:
 *   1. Re-fire `listings/qualified` to retry the preview pipeline (the
 *      original Inngest event may have failed silently — fal.ai out of
 *      credits, Inngest retry exhaustion, etc.)
 *   2. Single consolidated operator alert per cron run
 *
 * Twin of `order-stuck-watchdog` — covers the pre-payment side of the
 * same customer-loss surface. See META_ADS.md §5b for the case study
 * that drove this.
 *
 * Self-serve only — cold-discovered listings can sit forever without
 * previews and that's by design (preview only runs after qualification
 * for cold; for self-serve it should run immediately).
 *
 * Idempotency note: re-firing `listings/qualified` will create a new
 * preview row if one was generated in the interim. Low-cost duplicate
 * (~$0.25 in fal.ai per duplicate). Future cleanup: idempotency guard
 * inside the preview function itself.
 */

const STUCK_THRESHOLD_MIN = parseInt(env("PREVIEW_STUCK_THRESHOLD_MIN", "5") ?? "5", 10);

export const previewStuckWatchdogFn = inngest.createFunction(
  {
    id: "preview-stuck-watchdog",
    name: "Watchdog — stuck-without-preview self-serve listings",
    concurrency: { limit: 1 },
  },
  { cron: "*/5 * * * *" },
  async ({ step, logger }) => {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000);

    const stuck = await step.run("find-stuck-listings", async () => {
      const havingPreview = db.select({ id: previews.listingId }).from(previews);
      return await db
        .select()
        .from(listings)
        .where(
          and(
            eq(listings.source, "homeowner_self_serve"),
            lt(listings.createdAt, cutoff),
            notInArray(listings.id, havingPreview),
          ),
        )
        .limit(50); // safety cap
    });

    if (stuck.length === 0) return { stuck: 0 };

    logger.warn(`Found ${stuck.length} self-serve listings stuck without preview (>${STUCK_THRESHOLD_MIN} min)`);

    for (const listing of stuck) {
      await step.sendEvent(`retry-preview-${listing.id}`, {
        name: "listings/qualified",
        data: { listingId: listing.id },
      });
    }

    // Single consolidated alert per cron run.
    await step.run("ops-alert", async () => {
      const detail = stuck.slice(0, 10).map((l) => {
        const raw = l.createdAt as unknown;
        const ms =
          typeof raw === "string"
            ? Date.parse(raw)
            : raw instanceof Date
              ? raw.getTime()
              : Date.now();
        const mins = Math.round((Date.now() - ms) / 60_000);
        return `${l.id}  ${mins}m  ${(l as unknown as { listingUrl?: string }).listingUrl ?? "(no url)"}`;
      }).join("\n");

      await sendOperatorAlert({
        subject: `⚠ ${stuck.length} self-serve listing(s) stuck without preview`,
        summary: `${stuck.length} self-serve listings have been waiting >${STUCK_THRESHOLD_MIN} minutes for preview generation. The watchdog has re-fired listings/qualified for each. If this alert fires again on the next cron tick (5 min), the preview pipeline is broken — most common cause is fal.ai out of credits. Each stuck listing is a self-serve visitor sitting on /generating watching nothing happen.`,
        details: detail,
      });
    });

    return { stuck: stuck.length, retried: stuck.map((l) => l.id) };
  },
);

export async function countStuckSelfServeListings(thresholdMinutes = STUCK_THRESHOLD_MIN): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);
  const havingPreview = db.select({ id: previews.listingId }).from(previews);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(
      and(
        eq(listings.source, "homeowner_self_serve"),
        lt(listings.createdAt, cutoff),
        notInArray(listings.id, havingPreview),
      ),
    );
  return Number(row?.n ?? 0);
}
