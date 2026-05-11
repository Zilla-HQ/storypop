/**
 * Read-only diagnostic on Google Ads — pulls campaign, ad group, ad,
 * and keyword stats so we can decide whether to scale, restart, or
 * pause. Mirrors scripts/meta-snapshot.ts in spirit.
 */
const ENV = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v.trim();
};

const DEVELOPER_TOKEN = ENV("GOOGLE_ADS_DEVELOPER_TOKEN");
const CLIENT_ID = ENV("GOOGLE_ADS_CLIENT_ID");
const CLIENT_SECRET = ENV("GOOGLE_ADS_CLIENT_SECRET");
const REFRESH_TOKEN = ENV("GOOGLE_ADS_REFRESH_TOKEN");
const CUSTOMER_ID = ENV("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
const LOGIN_CUSTOMER_ID = ENV("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, "");
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v20";

async function mintAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  const j = (await r.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(`token mint failed: ${j.error_description}`);
  return j.access_token;
}

async function gaql<T>(accessToken: string, query: string): Promise<T[]> {
  const r = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": LOGIN_CUSTOMER_ID,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`gaql ${r.status}: ${text.slice(0, 600)}`);
  const j = JSON.parse(text) as { results?: T[] };
  return j.results ?? [];
}

interface CampaignRow {
  campaign: { id: string; name: string; status: string; advertisingChannelType: string };
  campaignBudget: { amountMicros: string };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string;
    ctr: number;
    averageCpc: string;
    conversions: number;
    conversionsValue: number;
  };
}

interface KeywordRow {
  adGroupCriterion: { criterionId: string; status: string; keyword: { text: string; matchType: string } };
  metrics: { impressions: string; clicks: string; costMicros: string; conversions: number };
}

async function main() {
  console.log("Google Ads snapshot\n");
  const access = await mintAccessToken();

  // ─── Campaigns ────────────────────────────────────────────────────────
  console.log("CAMPAIGNS:\n");
  const campaigns = await gaql<CampaignRow>(
    access,
    `SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC`,
  );
  if (campaigns.length === 0) console.log("  (no campaigns)");
  for (const c of campaigns) {
    const spend = Number(c.metrics.costMicros) / 1_000_000;
    const cpc = Number(c.metrics.averageCpc) / 1_000_000;
    const budget = Number(c.campaignBudget.amountMicros) / 1_000_000;
    console.log(`  · [${c.campaign.status.padEnd(10)}] ${c.campaign.name}`);
    console.log(`      id=${c.campaign.id}  type=${c.campaign.advertisingChannelType}  budget=$${budget.toFixed(2)}/day`);
    console.log(`      30d: spend=$${spend.toFixed(2)}  imp=${c.metrics.impressions}  clicks=${c.metrics.clicks}  CTR=${(c.metrics.ctr * 100).toFixed(2)}%  CPC=$${cpc.toFixed(2)}  conv=${c.metrics.conversions}  convValue=$${c.metrics.conversionsValue.toFixed(2)}`);
  }

  // ─── Top keywords ─────────────────────────────────────────────────────
  console.log("\nKEYWORDS (top 15 by spend, 30d):\n");
  const keywords = await gaql<KeywordRow>(
    access,
    `SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.status,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date DURING LAST_30_DAYS
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 15`,
  );
  if (keywords.length === 0) console.log("  (no keywords)");
  for (const k of keywords) {
    const spend = Number(k.metrics.costMicros) / 1_000_000;
    console.log(`  · [${k.adGroupCriterion.status.padEnd(8)}] "${k.adGroupCriterion.keyword.text}" (${k.adGroupCriterion.keyword.matchType})`);
    console.log(`      spend=$${spend.toFixed(2)}  imp=${k.metrics.impressions}  clicks=${k.metrics.clicks}  conv=${k.metrics.conversions}`);
  }

  // ─── Search-term insights — what people are actually searching ────────
  console.log("\nSEARCH TERMS (top 15 by impressions, 30d):\n");
  const terms = await gaql<{
    searchTermView: { searchTerm: string; status: string };
    metrics: { impressions: string; clicks: string; costMicros: string; conversions: number };
  }>(
    access,
    `SELECT
      search_term_view.search_term,
      search_term_view.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 15`,
  );
  if (terms.length === 0) console.log("  (no search terms)");
  for (const t of terms) {
    const spend = Number(t.metrics.costMicros) / 1_000_000;
    console.log(`  · [${t.searchTermView.status.padEnd(15)}] "${t.searchTermView.searchTerm}"`);
    console.log(`      imp=${t.metrics.impressions}  clicks=${t.metrics.clicks}  spend=$${spend.toFixed(2)}  conv=${t.metrics.conversions}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
export {};
