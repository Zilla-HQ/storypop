import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { trackEvent } from "@/lib/posthog";
import { deleteR2Object } from "@/lib/r2";

/**
 * StoryPop photo-purge cron. Daily 04:00 UTC.
 *
 * Walks every listing where `photoExpiresAt <= now()` and `photoUrl is not
 * null`. For each, deletes the R2 object and nulls the `photoUrl` column.
 * The purge is committed to the customer in the privacy policy ("photos
 * auto-purge after 30 days"); this is the cron that makes that real.
 *
 * Why the 30-day window: it has to outlast Lulu's print + ship timeline
 * (~10 days p99) plus a refund cushion (~14 days). 30 days fits cleanly.
 *
 * Per-listing failures don't fail the run — log + continue. A photo that
 * fails to delete stays scheduled for the next day's run.
 */

export const photoPurgeFn = inngest.createFunction(
  {
    id: "photo-purge",
    name: "StoryPop — daily photo purge (COPPA / privacy commitment)",
    retries: 1,
  },
  { cron: "0 4 * * *" },
  async ({ step, logger }) => {
    const due = await step.run("load-due", async () => {
      return db
        .select({
          id: listings.id,
          photoUrl: listings.photoUrl,
        })
        .from(listings)
        .where(
          and(
            isNotNull(listings.photoUrl),
            isNotNull(listings.photoExpiresAt),
            lte(listings.photoExpiresAt, new Date()),
          ),
        )
        .limit(500);
    });

    if (due.length === 0) {
      return { skipped: "nothing-due" };
    }

    let purged = 0;
    for (const row of due) {
      if (!row.photoUrl) continue;
      try {
        await step.run(`delete-${row.id}`, async () => {
          // photoUrl is the R2 key (relative). lib/r2 understands both
          // full URLs and bare keys; pass through as-is.
          await deleteR2Object(row.photoUrl ?? "");
        });
        await step.run(`null-${row.id}`, async () => {
          await db
            .update(listings)
            .set({ photoUrl: null, updatedAt: new Date() })
            .where(eq(listings.id, row.id));
        });
        await step.sendEvent(`emit-${row.id}`, {
          name: "photo/purged",
          data: { listingId: row.id, photoUrl: row.photoUrl },
        });
        await step.run(`track-${row.id}`, () =>
          trackEvent({
            distinctId: row.id,
            event: "photo_purged",
            properties: { listingId: row.id },
          }),
        );
        purged++;
      } catch (err) {
        logger.error(
          { listingId: row.id, err: err instanceof Error ? err.message : String(err) },
          "photo-purge: per-row error (will retry tomorrow)",
        );
      }
    }

    return { due: due.length, purged };
  },
);
