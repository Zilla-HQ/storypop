/**
 * Bing Webmaster Tools API client.
 *
 * Bing's API uses a single API key (no OAuth flow). The HQ-level key
 * is shared across all merchants. The Bing API also requires the parent
 * domain (zilla.so) to be verified at HQ once — child URL-prefix
 * properties inherit that verification, just like GSC.
 *
 * Required env vars (set at HQ vault — shared):
 *   ZILLA_BING_WEBMASTER_API_KEY
 *
 * API docs: https://learn.microsoft.com/en-us/bingwebmaster/
 */

const BING_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

function apiKey(): string {
  const k = process.env.ZILLA_BING_WEBMASTER_API_KEY;
  if (!k) {
    throw new Error(
      "Bing Webmaster API not configured: set ZILLA_BING_WEBMASTER_API_KEY.",
    );
  }
  return k;
}

async function bingFetch<TBody>(
  endpoint: string,
  body: TBody,
): Promise<{ ok: boolean; status: number; data: unknown; raw: string }> {
  const url = `${BING_BASE}/${endpoint}?apikey=${encodeURIComponent(apiKey())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const raw = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON response — return raw */
  }
  return { ok: res.ok, status: res.status, data, raw };
}

/**
 * Add a site to the Bing Webmaster account. Pass the full URL
 * (`https://xyz.zilla.so/`).
 *
 * Bing returns success even if the site is already added, so this is
 * idempotent.
 */
export async function addSite(siteUrl: string): Promise<void> {
  const result = await bingFetch("AddSite", {
    siteUrl,
  });
  // Bing's AddSite response is `{"d":null}` on success or an error
  // object. Treat any 200 OK as success — the API isn't picky about
  // re-adding existing sites.
  if (!result.ok) {
    throw new Error(
      `Bing addSite failed: HTTP ${result.status} ${result.raw.slice(0, 200)}`,
    );
  }
}

/**
 * Verify ownership of a site in Bing. Bing checks the BingSiteAuth.xml
 * file at the domain root and confirms the verification token matches.
 *
 * Required for apex-domain merchants (sitebeat.tech, realscale.app)
 * whose hostname isn't a subdomain of an already-verified Bing
 * property. For *.zilla.so merchants the parent zilla.so verification
 * covers them automatically; calling VerifySite is still safe
 * (returns true when already verified via inheritance).
 *
 * Returns true on verified, false otherwise. Throws on transport
 * errors.
 */
export async function verifySite(siteUrl: string): Promise<boolean> {
  const result = await bingFetch("VerifySite", { siteUrl });
  if (!result.ok) {
    throw new Error(
      `Bing verifySite failed: HTTP ${result.status} ${result.raw.slice(0, 200)}`,
    );
  }
  // Response: { "d": true } on success, { "d": false } if the
  // BingSiteAuth.xml file isn't reachable / doesn't match.
  return (result.data as { d?: boolean })?.d === true;
}

/**
 * Submit a sitemap to Bing for the given site. Pass full URLs for
 * both.
 */
export async function submitSitemap(siteUrl: string, sitemapUrl: string): Promise<void> {
  const result = await bingFetch("SubmitFeed", {
    siteUrl,
    feedUrl: sitemapUrl,
  });
  if (!result.ok) {
    throw new Error(
      `Bing submitSitemap failed: HTTP ${result.status} ${result.raw.slice(0, 200)}`,
    );
  }
}

/**
 * Get the list of sites in the Bing Webmaster account. Useful for
 * idempotent bootstrap — skip addSite if site already present.
 */
export async function getSites(): Promise<{ url: string }[]> {
  const result = await bingFetch("GetSites", {});
  if (!result.ok) {
    throw new Error(
      `Bing getSites failed: HTTP ${result.status} ${result.raw.slice(0, 200)}`,
    );
  }
  // Response shape: { d: [ { Url: "...", ... }, ... ] }
  const d = (result.data as { d?: { Url?: string }[] })?.d ?? [];
  return d
    .map((s) => (typeof s.Url === "string" ? { url: s.Url } : null))
    .filter((s): s is { url: string } => s !== null);
}

/**
 * Submit URLs to Bing's URL submission endpoint (legacy — IndexNow is
 * preferred). Useful if IndexNow is rate-limited or for verifying a
 * single URL got picked up.
 */
export async function submitUrls(siteUrl: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  // Bing's URL submission endpoint accepts up to 500 URLs per call
  // depending on the account's daily quota.
  const result = await bingFetch("SubmitUrlBatch", {
    siteUrl,
    urlList: urls.slice(0, 500),
  });
  if (!result.ok) {
    throw new Error(
      `Bing submitUrls failed: HTTP ${result.status} ${result.raw.slice(0, 200)}`,
    );
  }
}
