/**
 * Google Search Console API client.
 *
 * Auth: Zilla HQ owns a Google Cloud OAuth app + a refresh token that's
 * authorized for the parent `zilla.so` Domain property. Because GSC's
 * Domain property automatically inherits ownership to all subdomains,
 * we can add + verify + submit-sitemaps for any `*.zilla.so`
 * URL-prefix property without per-merchant OAuth.
 *
 * Apex-domain merchants (e.g. sitebeat.tech) need their own OAuth flow
 * — handled separately via the GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN env
 * var, which can override the HQ token.
 *
 * Required env vars (set at HQ vault — shared across all merchants):
 *   ZILLA_GSC_OAUTH_CLIENT_ID
 *   ZILLA_GSC_OAUTH_CLIENT_SECRET
 *   ZILLA_GSC_OAUTH_REFRESH_TOKEN
 *
 * Optional per-merchant override (only for apex-domain merchants):
 *   GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN  (with same client_id/secret)
 *
 * See ZILLA_HQ_SETUP.md for the one-time HQ provisioning steps.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SC_BASE = "https://www.googleapis.com/webmasters/v3";

interface AccessTokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

let cachedToken: AccessTokenCache | null = null;

async function getAccessToken(): Promise<string> {
  // Cache access tokens in-process for 50 minutes (Google grants 60).
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.ZILLA_GSC_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ZILLA_GSC_OAUTH_CLIENT_SECRET;
  const refreshToken =
    process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN ??
    process.env.ZILLA_GSC_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GSC API not configured: set ZILLA_GSC_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN (or merchant-specific GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN).",
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GSC token refresh failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

async function gscFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${SC_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Add a URL-prefix property to GSC. Idempotent — Google returns 204
 * whether the property exists or not.
 *
 * For Domain properties (no scheme/path), pass `sc-domain:zilla.so`.
 * For URL prefix properties, pass the full URL with trailing slash:
 * `https://xyz.zilla.so/`.
 */
export async function addSite(siteUrl: string): Promise<void> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await gscFetch(`/sites/${encoded}`, { method: "PUT" });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GSC addSite failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
}

/**
 * Check whether a property is already in the GSC account. Useful for
 * idempotent bootstrap — skip the addSite call if it's already there.
 */
export async function hasSite(siteUrl: string): Promise<boolean> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await gscFetch(`/sites/${encoded}`);
  return res.ok;
}

/**
 * Submit a sitemap to GSC. URL must be a full URL (`https://xyz.zilla.so/sitemap.xml`).
 * Idempotent — re-submitting the same sitemap URL just refreshes its
 * "last submitted" timestamp.
 */
export async function submitSitemap(siteUrl: string, sitemapUrl: string): Promise<void> {
  const encodedSite = encodeURIComponent(siteUrl);
  const encodedSitemap = encodeURIComponent(sitemapUrl);
  const res = await gscFetch(
    `/sites/${encodedSite}/sitemaps/${encodedSitemap}`,
    { method: "PUT" },
  );
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GSC submitSitemap failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
}

/**
 * List all properties in the GSC account. Useful for debugging.
 */
export async function listSites(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const res = await gscFetch(`/sites`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GSC listSites failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
  return json.siteEntry ?? [];
}
