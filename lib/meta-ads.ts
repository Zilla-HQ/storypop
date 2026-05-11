/**
 * Meta Marketing API integration.
 *
 * Manages Facebook/Instagram ad campaigns and pulls performance data so the
 * merchant template can show per-campaign CTR/CPC/CAC and pause unprofitable
 * campaigns from a daily Inngest cron.
 *
 * Env: META_ADS_ACCESS_TOKEN (system user token w/ ads_management),
 *      META_AD_ACCOUNT_ID    (numeric, no `act_` prefix).
 */

import { env } from "@/lib/env";

const ACCESS_TOKEN = env("META_ADS_ACCESS_TOKEN");
const API_VERSION = env("META_API_VERSION", "v19.0")!;
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time: string;
}

export interface SyncedCampaign {
  metaCampaignId: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  spentCents: number;
  conversionsCount: number;
  metadata: MetaInsightsMetadata;
}

export interface MetaInsightsMetadata {
  metaCampaignId: string;
  objective: string | null;
  dailyBudgetUsd: number | null;
  lifetimeBudgetUsd: number | null;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  qualityRanking: string | null;
  engagementRanking: string | null;
  conversionRanking: string | null;
  actions: Record<string, number>;
  dateStart: string | null;
  dateStop: string | null;
}

// Aggregated account-level rollup used by /admin ads panel. Distinct from
// per-campaign metadata above. Populated by getAdsInsights (account-wide
// summed across all active campaigns).
export interface AdsInsights {
  configured: boolean;
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number; // 0..1
  cpm: number; // dollars
  cpc: number; // dollars
  purchases: number;
  purchaseValueCents: number;
  costPerPurchase: number; // dollars; 0 if no purchases
  since: string;
  until: string;
  error?: string;
}

export async function getAdCampaigns(adAccountId: string): Promise<MetaCampaign[]> {
  if (!ACCESS_TOKEN) {
    console.warn("[meta-ads] META_ADS_ACCESS_TOKEN not set — returning empty campaigns");
    return [];
  }
  try {
    const url = `${BASE_URL}/act_${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time&access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error("[meta-ads] campaigns:", data.error.message);
      return [];
    }
    return (data.data || []) as MetaCampaign[];
  } catch (err) {
    console.error("[meta-ads] campaigns fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Pull a comprehensive insights field set: spend, CTR/CPC/CPM, reach + frequency,
 * Meta quality/engagement/conversion rankings, and the full actions breakdown so
 * the template can compute per-campaign CAC.
 */
export async function getCampaignInsights(
  campaignId: string,
  dateRange: "today" | "last_7d" | "last_30d" | "lifetime" = "last_30d",
): Promise<Record<string, unknown> | null> {
  if (!ACCESS_TOKEN) return null;
  try {
    const fields = [
      "impressions", "clicks", "spend", "actions", "action_values",
      "ctr", "cpc", "cpm", "reach", "frequency",
      "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
      "cost_per_action_type", "cost_per_inline_link_click",
      "date_start", "date_stop", "objective",
    ].join(",");
    const url = `${BASE_URL}/${campaignId}/insights?fields=${fields}&date_preset=${dateRange}&access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error("[meta-ads] insights:", data.error.message);
      return null;
    }
    return (data.data?.[0] as Record<string, unknown>) || null;
  } catch (err) {
    console.error("[meta-ads] insights fetch error:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function createAdCampaign(
  adAccountId: string,
  name: string,
  dailyBudgetUsd: number,
  objective = "OUTCOME_TRAFFIC",
): Promise<{ id: string } | null> {
  if (!ACCESS_TOKEN) {
    console.warn("[meta-ads] not configured — campaign creation simulated");
    return { id: `sim_${Date.now()}` };
  }
  try {
    const res = await fetch(`${BASE_URL}/act_${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        objective,
        status: "PAUSED", // Always start paused — the operator opts in.
        daily_budget: Math.round(dailyBudgetUsd * 100),
        special_ad_categories: [],
        access_token: ACCESS_TOKEN,
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("[meta-ads] create:", data.error.message);
      return null;
    }
    return { id: data.id };
  } catch (err) {
    console.error("[meta-ads] create error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Set a campaign's daily budget (in cents). Used by the lead-scaler to bump
 * +20% every 3 days. Returns true on success, false on Meta error.
 */
export async function updateCampaignDailyBudget(
  campaignId: string,
  dailyBudgetCents: number,
): Promise<boolean> {
  if (!ACCESS_TOKEN) return true;
  try {
    const res = await fetch(`${BASE_URL}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_budget: dailyBudgetCents, access_token: ACCESS_TOKEN }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("Meta update budget error:", data.error.message);
      return false;
    }
    return data.success === true;
  } catch (err: any) {
    console.error("Meta update budget error:", err.message);
    return false;
  }
}

export async function updateCampaignStatus(
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<boolean> {
  if (!ACCESS_TOKEN) return true;
  try {
    const res = await fetch(`${BASE_URL}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, access_token: ACCESS_TOKEN }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("[meta-ads] status error:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Pull every campaign on the ad account, fetch insights for each, and shape
 * the result into rows ready to upsert into the local `campaigns` table.
 *
 * Conversion priority (best signal first): purchase > offsite_conversion > lead.
 */
export async function syncCampaignData(adAccountId: string): Promise<SyncedCampaign[]> {
  const campaigns = await getAdCampaigns(adAccountId);
  const synced: SyncedCampaign[] = [];

  for (const campaign of campaigns) {
    const insights = (await getCampaignInsights(campaign.id, "last_30d")) ?? {};

    const actionsByType: Record<string, number> = {};
    for (const a of ((insights.actions as Array<{ action_type: string; value: string }>) || [])) {
      actionsByType[a.action_type] = parseFloat(a.value) || 0;
    }
    const conversions =
      actionsByType["purchase"] ??
      actionsByType["offsite_conversion"] ??
      actionsByType["lead"] ??
      0;

    const spendUsd = parseFloat((insights.spend as string) || "0");

    const metadata: MetaInsightsMetadata = {
      metaCampaignId: campaign.id,
      objective: campaign.objective || ((insights.objective as string) ?? null),
      dailyBudgetUsd: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
      lifetimeBudgetUsd: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
      reach: parseInt((insights.reach as string) || "0", 10),
      frequency: parseFloat((insights.frequency as string) || "0"),
      ctr: parseFloat((insights.ctr as string) || "0"),
      cpc: parseFloat((insights.cpc as string) || "0"),
      cpm: parseFloat((insights.cpm as string) || "0"),
      qualityRanking: (insights.quality_ranking as string) || null,
      engagementRanking: (insights.engagement_rate_ranking as string) || null,
      conversionRanking: (insights.conversion_rate_ranking as string) || null,
      actions: actionsByType,
      dateStart: (insights.date_start as string) || null,
      dateStop: (insights.date_stop as string) || null,
    };

    synced.push({
      metaCampaignId: campaign.id,
      name: campaign.name,
      status: campaign.status.toLowerCase(),
      impressions: parseInt((insights.impressions as string) || "0", 10),
      clicks: parseInt((insights.clicks as string) || "0", 10),
      spentCents: Math.round(spendUsd * 100),
      conversionsCount: Math.round(conversions),
      metadata,
    });

    // Be polite to Graph — same throttle as the sitegrid implementation.
    await new Promise((r) => setTimeout(r, 200));
  }

  return synced;
}
