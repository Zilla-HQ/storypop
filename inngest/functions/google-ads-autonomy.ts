import { inngest } from "@/inngest/client";
import { db, campaigns } from "@/db";
import { eq } from "drizzle-orm";
import {
  updateCampaignStatus,
  isGoogleAdsConfigured,
} from "@/lib/google-ads-client";

/**
 * Daily Google Ads autonomy.
 *
 * For every google-platform campaign in the snapshot:
 *   - If active and CAC > TARGET after MIN_SPEND → pause
 *   - If paused but historically profitable AND >= 3 conversions → resume
 *
 * Smart Bidding handles intra-day pacing well; this loop is for the
 * coarse open/closed decision on a per-campaign basis. Runs at 02:00
 * UTC, offset from the 01:00 Meta autonomy run so the two don't
 * pile up on the same minute.
 */
export const googleAdsAutonomyFn = inngest.createFunction(
  {
    id: "google-ads-autonomy",
    name: "Google Ads — daily CAC-based pause/resume",
    retries: 2,
  },
  [{ cron: "0 2 * * *" }, { event: "google-ads/autonomy" }],
  async ({ step, logger }) => {
    if (!isGoogleAdsConfigured()) {
      return { skipped: true, reason: "google ads creds missing" };
    }

    const targetCacUsd = Number(process.env.GOOGLE_TARGET_CAC_USD ?? "75");
    const purchaseValueUsd = Number(process.env.GOOGLE_PURCHASE_VALUE_USD ?? "199");
    const minSpendUsd = Number(process.env.GOOGLE_MIN_SPEND_USD ?? "50");
    const minConversionsForResume = Number(
      process.env.GOOGLE_MIN_CONVERSIONS_FOR_RESUME ?? "3",
    );

    const all = await step.run("load-google-campaigns", () =>
      db.select().from(campaigns).where(eq(campaigns.platform, "google")),
    );

    let paused = 0;
    let resumed = 0;

    for (const c of all) {
      const spentUsd = (c.spentCents ?? 0) / 100;
      const conv = c.conversionsCount ?? 0;
      if (spentUsd < minSpendUsd) continue;

      const cac = conv > 0 ? spentUsd / conv : Infinity;
      const profitable = cac < purchaseValueUsd * 0.5; // 50% margin floor

      if (c.status === "active" && cac > targetCacUsd) {
        const id = c.metaCampaignId ?? c.name;
        const ok = await step.run(`pause-${c.id}`, () =>
          updateCampaignStatus(id, "PAUSED"),
        );
        if (ok) {
          await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, c.id));
          paused += 1;
          logger.info(`Paused google ${c.name} — CAC $${cac.toFixed(2)} > $${targetCacUsd}`);
        }
      } else if (
        c.status === "paused" &&
        profitable &&
        conv >= minConversionsForResume
      ) {
        const id = c.metaCampaignId ?? c.name;
        const ok = await step.run(`resume-${c.id}`, () =>
          updateCampaignStatus(id, "ENABLED"),
        );
        if (ok) {
          await db.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, c.id));
          resumed += 1;
          logger.info(`Resumed google ${c.name} — CAC $${cac.toFixed(2)}`);
        }
      }
    }

    return { paused, resumed };
  },
);
