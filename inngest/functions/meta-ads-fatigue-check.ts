import { inngest } from "@/inngest/client";
import { getSettings } from "@/db/settings";
import { env } from "@/lib/env";

/**
 * Creative fatigue check — runs daily at 9am UTC.
 *
 * Iterates active ads under the lead campaign, flags any with last-7d
 * frequency > threshold (default 2.5). Fatigued ads = paying to re-show the
 * same audience = burning money. When flagged, refresh creative.
 *
 * For now this is just structured logging — pick up via Vercel/Inngest log
 * search. Wire to Slack / email later by filtering on the [ALERT] prefix.
 */
export const metaAdsFatigueCheckFn = inngest.createFunction(
  {
    id: "meta-ads-fatigue-check",
    name: "Meta — daily creative fatigue alert",
    retries: 2,
  },
  // 9am UTC daily, plus manual trigger.
  [{ cron: "0 9 * * *" }, { event: "meta-ads/fatigue-check" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    if (env("CRON_LEAD_SCALER_ENABLED", "true") === "false") {
      return { skipped: true, reason: "disabled-by-env" };
    }
    const TOKEN = env("META_ADS_ACCESS_TOKEN");
    const campaignId = env("META_LEAD_CAMPAIGN_ID");
    if (!TOKEN || !campaignId) {
      return { skipped: true, reason: "not-configured" };
    }
    const V = env("META_API_VERSION", "v19.0");
    const threshold = Number(env("META_LEAD_FATIGUE_FREQUENCY", "2.5"));

    const data = await step.run("fetch-ads-with-insights", async () => {
      const url = `https://graph.facebook.com/${V}/${campaignId}/ads?fields=id,name,effective_status,insights.date_preset(last_7d){frequency,impressions,spend}&limit=50&access_token=${TOKEN}`;
      const res = await fetch(url);
      const j: any = await res.json();
      if (j.error) throw new Error(j.error.message);
      return j.data || [];
    });

    let flagged = 0;
    let checked = 0;
    for (const ad of data as any[]) {
      if (ad.effective_status !== "ACTIVE") continue;
      checked++;
      const ins = ad.insights?.data?.[0];
      const freq = parseFloat(ins?.frequency || "0");
      if (freq > threshold) {
        logger.warn(`[fatigue-check] [ALERT] ad "${ad.name}" frequency ${freq.toFixed(2)} > ${threshold} (impr ${ins.impressions}, spent $${ins.spend}) — refresh creative`);
        flagged++;
      }
    }

    return { flagged, checked, threshold };
  },
);
