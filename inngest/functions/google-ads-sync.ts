import { inngest } from "@/inngest/client";
import { db, campaigns } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  syncCampaigns,
  isGoogleAdsConfigured,
} from "@/lib/google-ads-client";

/**
 * Hourly Google Ads metric sync. Pulls last-7d insights for every
 * campaign on the connected ad account and upserts into the `campaigns`
 * table with platform='google'. The downstream autonomy cron reads from
 * this snapshot — keeps decisions deterministic and cheap.
 *
 * No-ops silently if Google Ads creds aren't configured, which is the
 * real switch (vs. needing a flag).
 */
export const googleAdsSyncFn = inngest.createFunction(
  {
    id: "google-ads-sync",
    name: "Google Ads — hourly metric sync",
    retries: 2,
  },
  [{ cron: "0 * * * *" }, { event: "google-ads/sync" }],
  async ({ step, logger }) => {
    if (!isGoogleAdsConfigured()) {
      return { skipped: true, reason: "google ads creds missing" };
    }

    const synced = await step.run("fetch-insights", () => syncCampaigns());

    for (const c of synced) {
      const existing = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.platform, "google"),
            eq(campaigns.metaCampaignId, c.campaignId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(campaigns)
          .set({
            status: c.status,
            impressions: c.impressions,
            clicks: c.clicks,
            spentCents: Math.round(c.spent * 100),
            conversionsCount: Math.round(c.conversions),
          })
          .where(eq(campaigns.id, existing[0].id));
      } else {
        await db.insert(campaigns).values({
          platform: "google",
          metaCampaignId: c.campaignId, // reuse column as join key — see comments in campaigns table
          name: c.name,
          status: c.status,
          spentCents: Math.round(c.spent * 100),
          impressions: c.impressions,
          clicks: c.clicks,
          conversionsCount: Math.round(c.conversions),
        });
      }
    }

    logger.info(`google-ads-sync: ${synced.length} campaigns refreshed`);
    return { synced: synced.length };
  },
);
