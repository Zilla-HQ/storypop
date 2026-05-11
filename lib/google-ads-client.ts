/**
 * Google Ads — direct REST integration.
 *
 * Mirrors the design of lib/meta-ads.ts (no SDK; we hit the REST surface
 * directly with fetch). Google Ads requires:
 *   - OAuth access token (derived from a long-lived refresh token)
 *   - Developer token (account-level, granted by Google)
 *   - Customer ID (the merchant's ad account)
 *   - Login-Customer-Id header when the account is under an MCC
 *
 * Surface we expose:
 *   - syncCampaigns(): last-7d metrics per campaign
 *   - updateCampaignStatus(id, "ENABLED"|"PAUSED")
 *   - getCampaignBudget(id) + updateCampaignBudget(...)
 *   - createCustomerClient + createConversionAction (one-shot bootstrap)
 *
 * Budget scaling is NOT auto-exposed for routine use: Google's Smart
 * Bidding handles intra-day pacing better than a coarse daily-budget
 * scaler. Use the budget helpers only for branded-defense ramp.
 *
 * Docs: https://developers.google.com/google-ads/api/rest/overview
 */

const ADS_API_VERSION = "v17";
const ADS_BASE = `https://googleads.googleapis.com/${ADS_API_VERSION}`;
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

interface AccessTokenEnv {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function readAccessTokenEnv(): AccessTokenEnv | null {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

/**
 * Exchange the refresh token for a short-lived access token. Cached
 * in-process for ~50 minutes (Google grants 60).
 */
async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > now) {
    return cachedAccessToken.token;
  }
  const cfg = readAccessTokenEnv();
  if (!cfg) return null;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error(
      `[google-ads:oauth] token refresh failed: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  };
  return json.access_token;
}

interface AdsHeaderConfig {
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}

function readHeaderConfig(): AdsHeaderConfig | null {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!developerToken || !customerId) return null;
  const cleanCustomer = customerId.replace(/[^0-9]/g, "");
  const loginRaw = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  return {
    developerToken,
    customerId: cleanCustomer,
    loginCustomerId: loginRaw ? loginRaw.replace(/[^0-9]/g, "") : undefined,
  };
}

async function adsRequest(path: string, body?: unknown): Promise<unknown | null> {
  const token = await getAccessToken();
  const cfg = readHeaderConfig();
  if (!token || !cfg) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
  };
  if (cfg.loginCustomerId) headers["login-customer-id"] = cfg.loginCustomerId;

  const url = `${ADS_BASE}/customers/${cfg.customerId}${path}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error(`[google-ads] ${path} failed: HTTP ${res.status} ${text.slice(0, 400)}`);
    return null;
  }
  return res.json();
}

export interface GoogleAdsCampaignMetric {
  campaignId: string;
  name: string;
  /** Lowercased: "active", "paused", "completed", "draft". */
  status: string;
  spent: number; // dollars
  impressions: number;
  clicks: number;
  conversions: number;
  metadata: string; // JSON-stringified raw row
}

const STATUS_MAP: Record<string, string> = {
  ENABLED: "active",
  PAUSED: "paused",
  REMOVED: "completed",
  UNKNOWN: "draft",
  UNSPECIFIED: "draft",
};

interface SearchStreamChunk {
  results?: Array<{
    campaign?: { id?: string; name?: string; status?: string };
    metrics?: {
      costMicros?: number | string;
      impressions?: number | string;
      clicks?: number | string;
      conversions?: number | string;
    };
    campaignBudget?: { resourceName?: string; amountMicros?: number | string };
  }>;
}

function flattenSearchStream(result: unknown): SearchStreamChunk["results"] {
  if (Array.isArray(result)) {
    return result.flatMap((r) =>
      Array.isArray((r as SearchStreamChunk).results)
        ? (r as SearchStreamChunk).results!
        : [],
    );
  }
  if (result && typeof result === "object" && Array.isArray((result as SearchStreamChunk).results)) {
    return (result as SearchStreamChunk).results;
  }
  return [];
}

/**
 * Pull campaign-level metrics for the last 7 days. We aggregate over a
 * rolling window because day-of-day attribution is too noisy for low-
 * volume conversion data — autonomy decisions should be made on 7d.
 */
export async function syncCampaigns(): Promise<GoogleAdsCampaignMetric[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
  `.trim();

  const result = await adsRequest("/googleAds:searchStream", { query });
  if (!result) return [];

  const rows = flattenSearchStream(result) ?? [];
  return rows.map((row) => {
    const camp = row.campaign ?? {};
    const m = row.metrics ?? {};
    const costMicros = Number(m.costMicros || 0);
    return {
      campaignId: String(camp.id ?? ""),
      name: String(camp.name ?? ""),
      status: STATUS_MAP[String(camp.status ?? "UNKNOWN")] ?? "draft",
      spent: costMicros / 1_000_000,
      impressions: Number(m.impressions || 0),
      clicks: Number(m.clicks || 0),
      conversions: Number(m.conversions || 0),
      metadata: JSON.stringify({
        rawStatus: camp.status,
        costMicros,
        rawConversions: m.conversions,
      }),
    };
  });
}

/**
 * Pause or resume a campaign by ID. Update mask is "status" only — any
 * unmasked field would be silently blanked.
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: "ENABLED" | "PAUSED",
): Promise<boolean> {
  const cfg = readHeaderConfig();
  if (!cfg) return false;
  const resourceName = `customers/${cfg.customerId}/campaigns/${campaignId}`;
  const result = await adsRequest("/campaigns:mutate", {
    operations: [{ update: { resourceName, status }, updateMask: "status" }],
  });
  return !!result;
}

export function isGoogleAdsConfigured(): boolean {
  return readAccessTokenEnv() !== null && readHeaderConfig() !== null;
}

/**
 * Get a campaign's budget resource_name + current daily-budget micros.
 * Needed before scaling a budget — the campaign references a separate
 * campaign_budget resource.
 */
export async function getCampaignBudget(campaignId: string): Promise<{
  resourceName: string;
  amountMicros: number;
} | null> {
  const query = `
    SELECT campaign.id, campaign_budget.resource_name, campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id = ${campaignId}
    LIMIT 1
  `.trim();
  const result = await adsRequest("/googleAds:searchStream", { query });
  if (!result) return null;
  const rows = flattenSearchStream(result) ?? [];
  const first = rows[0];
  if (!first?.campaignBudget) return null;
  return {
    resourceName: String(first.campaignBudget.resourceName ?? ""),
    amountMicros: Number(first.campaignBudget.amountMicros ?? 0),
  };
}

export async function updateCampaignBudget(
  budgetResourceName: string,
  amountMicros: number,
): Promise<boolean> {
  const result = await adsRequest("/campaignBudgets:mutate", {
    operations: [
      {
        update: {
          resourceName: budgetResourceName,
          amountMicros: String(amountMicros),
        },
        updateMask: "amountMicros",
      },
    ],
  });
  return !!result;
}

/**
 * Bootstrap helper: create a new ad account (CustomerClient) under the
 * MCC. Used by the Zilla-HQ → sub-co provisioning script so engineers
 * don't have to click through Tools → Accounts → + in the UI.
 */
export async function createCustomerClient(args: {
  descriptiveName: string;
  currencyCode?: string;
  timeZone?: string;
}): Promise<{ resourceName: string; customerId: string } | null> {
  const cfg = readHeaderConfig();
  const tokenCfg = readAccessTokenEnv();
  if (!cfg || !tokenCfg) return null;
  const token = await getAccessToken();
  if (!token) return null;

  const mccId = cfg.loginCustomerId || cfg.customerId;
  const url = `${ADS_BASE}/customers/${mccId}:createCustomerClient`;
  const body = {
    customerClient: {
      descriptiveName: args.descriptiveName,
      currencyCode: args.currencyCode || "USD",
      timeZone: args.timeZone || "America/New_York",
    },
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
    "login-customer-id": mccId,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error(
      `[google-ads:createCustomerClient] HTTP ${res.status} ${text.slice(0, 400)}`,
    );
    return null;
  }
  const json = (await res.json()) as { resourceName?: string };
  if (!json.resourceName) return null;
  const customerId = json.resourceName.split("/").pop() ?? "";
  return { resourceName: json.resourceName, customerId };
}

/**
 * One-shot: create a Purchase conversion action with URL-pattern
 * tracking. Eliminates the manual "Tools → Conversions → New" UI flow.
 */
export async function createConversionAction(args: {
  customerId?: string;
  name: string;
  defaultValueUsd: number;
  urlMatchPattern?: string;
}): Promise<{ resourceName: string; conversionActionId: string } | null> {
  const cfg = readHeaderConfig();
  if (!cfg) return null;
  const customerId = (args.customerId || cfg.customerId).replace(/[^0-9]/g, "");
  const token = await getAccessToken();
  if (!token) return null;

  const mutate = {
    operations: [
      {
        create: {
          name: args.name,
          category: "PURCHASE",
          status: "ENABLED",
          type: "WEBPAGE",
          countingType: "ONE_PER_CLICK",
          clickThroughLookbackWindowDays: "30",
          valueSettings: {
            defaultValue: args.defaultValueUsd,
            defaultCurrencyCode: "USD",
            alwaysUseDefaultValue: false,
          },
          ...(args.urlMatchPattern
            ? {
                webpage: {
                  conditions: [
                    {
                      operand: "URL",
                      operator: "CONTAINS",
                      argument: args.urlMatchPattern,
                    },
                  ],
                },
              }
            : {}),
        },
      },
    ],
  };

  const url = `${ADS_BASE}/customers/${customerId}/conversionActions:mutate`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
  };
  if (cfg.loginCustomerId) headers["login-customer-id"] = cfg.loginCustomerId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(mutate),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error(
      `[google-ads:createConversionAction] HTTP ${res.status} ${text.slice(0, 400)}`,
    );
    return null;
  }
  const json = (await res.json()) as { results?: Array<{ resourceName: string }> };
  const resourceName = json.results?.[0]?.resourceName;
  if (!resourceName) return null;
  return {
    resourceName,
    conversionActionId: resourceName.split("/").pop() ?? "",
  };
}
