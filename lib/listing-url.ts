/**
 * Parse a user-submitted real estate listing URL and detect its source.
 * Returns null if the URL doesn't look like a supported listing page.
 */
export type ListingSource = "zillow" | "redfin" | "realtor";

export interface ParsedListingUrl {
  source: ListingSource;
  sourceId: string; // zpid / redfin propertyId / realtor property_id
  canonicalUrl: string;
}

export function parseListingUrl(raw: string): ParsedListingUrl | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host.endsWith("zillow.com")) {
    // /homedetails/.../<zpid>_zpid/
    const m = url.pathname.match(/\/(\d+)_zpid/);
    if (m) return { source: "zillow", sourceId: m[1], canonicalUrl: url.toString() };
  }

  if (host.endsWith("redfin.com")) {
    // /home/<propertyId> or /CA/.../<id>
    const m = url.pathname.match(/\/home\/(\d+)/) ?? url.pathname.match(/\/(\d+)$/);
    if (m) return { source: "redfin", sourceId: m[1], canonicalUrl: url.toString() };
  }

  if (host.endsWith("realtor.com")) {
    // /realestateandhomes-detail/.../M<propertyId>
    const m =
      url.pathname.match(/M(\d+)(?:$|\?)/) ??
      url.pathname.match(/\/([\w-]+)$/);
    if (m) return { source: "realtor", sourceId: m[1], canonicalUrl: url.toString() };
  }

  return null;
}
