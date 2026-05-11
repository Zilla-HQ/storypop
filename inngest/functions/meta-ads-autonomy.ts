import { inngest } from "@/inngest/client";
import { db, campaigns } from "@/db";
import { getSettings } from "@/db/settings";
import { updateCampaignStatus } from "@/lib/meta-ads";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";

/**
 * Daily Meta ad autonomy.
 *
 * Looks at every Meta campaign in the local snapshot table and decides:
 *   - If active and CAC > target after enough spend → pause via Graph API
 *   - If paused but historically profitable AND has ≥3 conversions → resume
 *
 * "Enough spend" defaults to META_MIN_SPEND_USD before any pause decision so a
 * fresh campaign isn't killed for noise. Operator can override every threshold
 * via env without redeploying.
 *
 * Money inputs come from env in dollars; the campaigns table stores cents, so
 * conversions happen here.
 */
export const metaAdsAutonomyFn = inngest.createFunction(
  {
    id: "meta-ads-autonomy",
    name: "Meta — daily ROAS-based pause/resume",
    retries: 2,
  },
  // 1am UTC daily, plus manual trigger.
  [{ cron: "0 1 * * *" }, { event: "meta-ads/autonomy" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) {
      logger.info("Meta ads autonomy skipped: platform paused");
      return { skipped: true, reason: "paused" };
    }

    if (!env("META_AD_ACCOUNT_ID") || !env("META_ADS_ACCESS_TOKEN")) {
      logger.warn("Meta ads autonomy skipped: credentials missing");
      return { skipped: true, reason: "not-configured" };
    }

    const targetCacUsd = Number(env("META_TARGET_CAC_USD", "75"));
    const purchaseValueUsd = Number(env("META_PURCHASE_VALUE_USD", "199"));
    const minSpendUsd = Number(env("META_MIN_SPEND_USD", "50"));

    const all = await step.run("load-meta-campaigns", () =>
      db.select().from(campaigns).where(eq(campaigns.platform, "meta")),
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
        const ok = await step.run(`pause-${c.id}`, () =>
          updateCampaignStatus(c.metaCampaignId ?? c.name, "PAUSED"),
        );
        if (ok) {
          await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, c.id));
          paused += 1;
          logger.info(`Paused ${c.name} — CAC $${cac.toFixed(2)} > target $${targetCacUsd}`);
        }
      } else if (c.status === "paused" && profitable && conv >= 3) {
        const ok = await step.run(`resume-${c.id}`, () =>
          updateCampaignStatus(c.metaCampaignId ?? c.name, "ACTIVE"),
        );
        if (ok) {
          await db.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, c.id));
          resumed += 1;
          logger.info(`Resumed ${c.name} — historical CAC $${cac.toFixed(2)}`);
        }
      }
    }

    return { paused, resumed, evaluated: all.length };
  },
);
