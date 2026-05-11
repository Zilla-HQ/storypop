/**
 * Helpers for normalizing user-supplied domain strings into a stable
 * lookup key. Used by the public `/seo-audit/[domain]` route, the
 * `/tools/*` pages, and anywhere else we accept a free-form host.
 */

export function normalizeDomain(raw: string): string | null {
  if (!raw) return null;
  let s = decodeURIComponent(raw).trim().toLowerCase();
  if (!s) return null;

  // Strip protocol if present
  s = s.replace(/^https?:\/\//, "");
  // Strip leading "www."
  s = s.replace(/^www\./, "");
  // Trim trailing slash + anything after the hostname
  s = s.split("/")[0];
  // Strip port
  s = s.split(":")[0];

  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (!s.includes(".")) return null;
  if (s.length > 253) return null;

  return s;
}

export function domainFromSiteUrl(siteUrl: string): string | null {
  try {
    return normalizeDomain(new URL(siteUrl).hostname);
  } catch {
    return null;
  }
}
