import { env } from "@/lib/env";

/**
 * Meta (Facebook + Instagram) ad insights pulled from the Marketing API.
 *
 * Requires META_ACCESS_TOKEN — a System User access token with `ads_read`
 * permission on the Sitebeat ad account. Generate at:
 *   Business Settings → Users → System Users → (your system user) →
 *   Generate New Token → pick the Sitebeat app → permissions: ads_read
 *
 * Without the token, returns ZERO with `error` populated; the admin
 * dashboard renders a "connect Meta Marketing API" prompt.
 */

export interface MetaAdsReport {
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number; // cost per 1000 impressions
  cpc: number; // cost per click
  ctr: number; // click-through rate (0-1)
  conversions: number; // # of optimization-event firings
  costPerConversion: number;
  configured: boolean;
  error?: string;
  fetchedAt: string;
}

const ZERO: MetaAdsReport = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  cpm: 0,
  cpc: 0,
  ctr: 0,
  conversions: 0,
  costPerConversion: 0,
  configured: false,
  fetchedAt: new Date().toISOString(),
};

interface InsightsResponse {
  data?: Array<{
    spend?: string;
    impressions?: string;
    clicks?: string;
    cpm?: string;
    cpc?: string;
    ctr?: string;
    actions?: Array<{ action_type: string; value: string }>;
    cost_per_action_type?: Array<{ action_type: string; value: string }>;
  }>;
  error?: { message: string };
}

export async function getMetaAdsReport(): Promise<MetaAdsReport> {
  const token = env("META_ACCESS_TOKEN");
  const adAccountId = env("META_AD_ACCOUNT_ID", "973392158720576");
  if (!token) {
    return { ...ZERO, error: "META_ACCESS_TOKEN not set" };
  }

  try {
    // Lifetime preset gives all-time data — appropriate for a brand-new
    // account. Once the campaign is mature switch to date_preset=last_30d.
    const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=spend,impressions,clicks,cpm,cpc,ctr,actions,cost_per_action_type&date_preset=maximum&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ...ZERO, error: `Meta ${res.status}: ${body.slice(0, 150)}` };
    }
    const json = (await res.json()) as InsightsResponse;
    const row = json.data?.[0];
    if (!row) {
      return { ...ZERO, configured: true, error: "No data yet (campaign still in review or no impressions)" };
    }
    // Pull "Audit Submitted" custom-conversion as our optimization metric;
    // fall back to "lead" or first action.
    const conversions =
      Number(row.actions?.find((a) => a.action_type.includes("Audit"))?.value ??
        row.actions?.find((a) => a.action_type === "lead")?.value ??
        row.actions?.[0]?.value ??
        0);
    const spend = Number(row.spend ?? 0);
    const costPerConversion = conversions > 0 ? spend / conversions : 0;

    return {
      spend,
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      cpm: Number(row.cpm ?? 0),
      cpc: Number(row.cpc ?? 0),
      ctr: Number(row.ctr ?? 0) / 100, // Meta returns CTR as percent (e.g. 1.5 = 1.5%)
      conversions,
      costPerConversion,
      configured: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { ...ZERO, error: (err as Error).message };
  }
}
