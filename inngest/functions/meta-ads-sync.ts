import { inngest } from "@/inngest/client";
import { db, campaigns } from "@/db";
import { getSettings } from "@/db/settings";
import { syncCampaignData } from "@/lib/meta-ads";
import { env } from "@/lib/env";
import { eq, sql } from "drizzle-orm";

/**
 * Hourly Meta ad insights sync.
 *
 * Pulls every campaign on the configured ad account, fetches 30-day insights
 * for each, and upserts a snapshot into the `campaigns` table. The admin UI
 * reads from this table; the autonomy job (meta-ads-autonomy.ts) decides
 * pause/resume off of `spentCents` + `conversionsCount`.
 *
 * Skipped if META_AD_ACCOUNT_ID / META_ADS_ACCESS_TOKEN are not set or the
 * operator has paused the platform from /admin.
 */
export const metaAdsSyncFn = inngest.createFunction(
  {
    id: "meta-ads-sync",
    name: "Meta — hourly insights sync",
    retries: 3,
  },
  // Top of every hour, plus a manual trigger from /admin.
  [{ cron: "0 * * * *" }, { event: "meta-ads/sync" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) {
      logger.info("Meta ads sync skipped: platform paused");
      return { skipped: true, reason: "paused" };
    }

    const adAccountId = env("META_AD_ACCOUNT_ID");
    const accessToken = env("META_ADS_ACCESS_TOKEN");
    if (!adAccountId || !accessToken) {
      logger.warn("Meta ads sync skipped: META_AD_ACCOUNT_ID or META_ADS_ACCESS_TOKEN missing");
      return { skipped: true, reason: "not-configured" };
    }

    const synced = await step.run("fetch-and-shape", () => syncCampaignData(adAccountId));

    const upserted = await step.run("upsert-campaigns", async () => {
      let inserted = 0;
      let updated = 0;
      for (const c of synced) {
        const [existing] = await db
          .select({ id: campaigns.id })
          .from(campaigns)
          .where(eq(campaigns.metaCampaignId, c.metaCampaignId))
          .limit(1);

        if (existing) {
          await db
            .update(campaigns)
            .set({
              name: c.name,
              status: c.status,
              impressions: c.impressions,
              clicks: c.clicks,
              spentCents: c.spentCents,
              conversionsCount: c.conversionsCount,
              metadata: c.metadata,
              updatedAt: sql`now()`,
            })
            .where(eq(campaigns.id, existing.id));
          updated += 1;
        } else {
          await db.insert(campaigns).values({
            platform: "meta",
            metaCampaignId: c.metaCampaignId,
            name: c.name,
            status: c.status,
            budgetCents: 0,
            spentCents: c.spentCents,
            impressions: c.impressions,
            clicks: c.clicks,
            conversionsCount: c.conversionsCount,
            metadata: c.metadata,
          });
          inserted += 1;
        }
      }
      return { inserted, updated };
    });

    logger.info(
      `Meta sync: ${upserted.inserted} new, ${upserted.updated} updated (${synced.length} pulled)`,
    );
    return { synced: synced.length, ...upserted };
  },
);
