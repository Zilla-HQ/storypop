import { inngest } from "@/inngest/client";
import { getSettings } from "@/db/settings";
import { updateCampaignStatus, updateCampaignDailyBudget, getCampaignInsights } from "@/lib/meta-ads";
import { env } from "@/lib/env";

/**
 * Lead-CAC budget scaler for the OUTCOME_LEADS campaign.
 *
 * Stateless math: each run derives the target budget purely from days-since-
 * launch. No DB writes for the schedule — the operator-knob is the env config
 * (launch date + budget bands), not stored state. If you manually edit the
 * budget in Ads Manager, this scaler will revert it on the next run. That is
 * intentional.
 *
 * Schedule (defaults; all configurable via env):
 *   Day  0:    $75/day  (launch)
 *   Day  3:    $90/day  (+20%)
 *   Day  6:   $108/day
 *   Day  9:   $130/day
 *   Day 12:   $156/day
 *   Day 15:   $187/day  (CAC ceiling tightens to $5)
 *   Day 18:   $200/day  (capped)
 *
 * Pause-on-CAC-breach:
 *   - Wait until $50+ spent before any pause decision (else young campaign is
 *     killed for noise)
 *   - Day 0-13: ceiling $7
 *   - Day 14+:  ceiling $5
 *
 * Configure via env: META_LEAD_CAMPAIGN_ID, META_LEAD_LAUNCH_DATE,
 * META_LEAD_INITIAL_BUDGET_CENTS, META_LEAD_MAX_BUDGET_CENTS,
 * META_LEAD_CAC_CEILING_EARLY, META_LEAD_CAC_CEILING_STEADY,
 * META_LEAD_MIN_SPEND. Kill switch: CRON_LEAD_SCALER_ENABLED=false.
 */
export const metaAdsLeadScalerFn = inngest.createFunction(
  {
    id: "meta-ads-lead-scaler",
    name: "Meta — daily lead-CAC budget scaler",
    retries: 2,
  },
  // 1:30am UTC daily, plus manual trigger from /admin.
  [{ cron: "30 1 * * *" }, { event: "meta-ads/lead-scaler" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    if (env("CRON_LEAD_SCALER_ENABLED", "true") === "false") {
      return { skipped: true, reason: "disabled-by-env" };
    }
    if (!env("META_AD_ACCOUNT_ID") || !env("META_ADS_ACCESS_TOKEN")) {
      return { skipped: true, reason: "not-configured" };
    }
    const campaignId = env("META_LEAD_CAMPAIGN_ID");
    const launchDate = env("META_LEAD_LAUNCH_DATE");
    if (!campaignId || !launchDate) {
      return { skipped: true, reason: "no-campaign-configured" };
    }

    const initial = Number(env("META_LEAD_INITIAL_BUDGET_CENTS", "7500"));
    const max = Number(env("META_LEAD_MAX_BUDGET_CENTS", "20000"));
    const cacEarly = Number(env("META_LEAD_CAC_CEILING_EARLY", "7"));
    const cacSteady = Number(env("META_LEAD_CAC_CEILING_STEADY", "5"));
    const minSpend = Number(env("META_LEAD_MIN_SPEND", "50"));

    const launch = new Date(launchDate + "T00:00:00Z").getTime();
    const days = Math.floor((Date.now() - launch) / 86_400_000);
    const ceiling = days >= 14 ? cacSteady : cacEarly;
    const bumps = Math.max(0, Math.floor(days / 3));
    const targetBudget = Math.min(max, Math.round(initial * Math.pow(1.2, bumps)));

    const insights = await step.run("fetch-insights", () =>
      getCampaignInsights(campaignId, "last_7d"),
    );

    const spend = parseFloat((insights as any)?.spend || "0");
    const actions: any[] = (insights as any)?.actions || [];
    let leads = 0;
    for (const a of actions) {
      if (a.action_type === "offsite_conversion.fb_pixel_lead") { leads = Number(a.value) || 0; break; }
    }
    if (!leads) {
      for (const a of actions) {
        if (a.action_type === "lead") { leads = Number(a.value) || 0; break; }
      }
    }
    const cac = leads > 0 ? spend / leads : null;

    logger.info(`[lead-scaler] day ${days}  spend $${spend.toFixed(2)}  leads ${leads}  CAC ${cac == null ? "—" : `$${cac.toFixed(2)}`}  ceiling $${ceiling}  target $${targetBudget / 100}/day`);

    // Pause on breach (only after meaningful spend)
    if (spend >= minSpend && cac != null && cac > ceiling) {
      logger.warn(`[lead-scaler] [ALERT] CAC $${cac.toFixed(2)} > ceiling $${ceiling} after $${spend.toFixed(2)} spent — pausing campaign ${campaignId}`);
      const ok = await step.run("pause-campaign", () =>
        updateCampaignStatus(campaignId, "PAUSED"),
      );
      return { paused: ok, reason: "cac-breach", spend, leads, cac, days, targetBudget, ceiling };
    }

    // Otherwise apply the target budget. Re-derives each run; no state.
    const ok = await step.run("set-budget", () =>
      updateCampaignDailyBudget(campaignId, targetBudget),
    );
    return { paused: false, budgetSetOk: ok, spend, leads, cac, days, targetBudget, ceiling };
  },
);
