/**
 * Direct Airbnb listing fetch — no Apify, no actor, no minute-long sync wait.
 * Pulls a public listing page with a browser-flavoured User-Agent and extracts
 * the structured signals we need for self-serve preview generation.
 *
 * The page returns: title, description (meta), photos (muscache CDN URLs),
 * host name, isSuperHost, starRating, reviewCount, city, lat/lng, capacity.
 * Nightly rate is NOT publicly returned without a date-range API call —
 * `price` is set to 0 here; comp-pricing fills it in downstream.
 *
 * Trade-off vs Apify:
 *   + Fast (~1-3s vs Apify's 60-180s)
 *   + Free (no actor compute units)
 *   + Works for single-URL self-serve where Apify URL-actors fail
 *   - Vercel egress IPs may eventually get rate-limited by Airbnb at scale
 *     (Apify's residential proxy pool is the long-term fallback)
 */

import type { ScrapedListing } from "@/lib/apify";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchAirbnbListingDirect(url: string): Promise<ScrapedListing | null> {
  const sourceId = extractListingId(url);
  if (!sourceId) return null;

  const res = await fetch(`https://www.airbnb.com/rooms/${sourceId}`, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[airbnb-direct] HTTP ${res.status} for ${sourceId}`);
    return null;
  }
  const html = await res.text();

  // ─── Extract title (from og:description or first JSON `name`) ──────────
  const ogDesc = matchAttr(html, /<meta property="og:description"[^>]*content="([^"]+)"/);
  const ogTitle = matchAttr(html, /<meta property="og:title"[^>]*content="([^"]+)"/);
  const titleFromJson = matchAttr(html, /"name":"([^"]{5,200})"/);
  const title = (ogDesc || titleFromJson || ogTitle || "").trim();

  // ─── Description (from meta name=description) ──────────────────────────
  const description = (matchAttr(html, /<meta name="description"[^>]*content="([^"]+)"/) || "").trim();

  // ─── Photos: dedupe muscache URLs, prefer high-res ────────────────────
  // CRITICAL FILTER: Airbnb embeds AI-synthesized review-summary thumbnails
  // alongside the real listing photos in the page HTML. These live at
  // `/im/pictures/AirbnbPlatformAssets/...` and are stylized illustrations
  // generated from review text — NOT photos of the property. We saw this
  // bug burn the first paid customer (William Virgo, refund 2026-05-07):
  // the preview pipeline picked two of these review-summary stubs to demo,
  // William saw cartoon gift-box and window images, refunded immediately.
  //
  // Real listing photos are always under `/prohost-api/Hosting-<id>/` or
  // `/miso/Hosting-<id>/`. Filter to those; skip platform assets.
  const photoSet = new Set<string>();
  const photoMatches = html.matchAll(/"baseUrl":"(https:\/\/a0\.muscache\.com\/im\/pictures\/[^"]+)"/g);
  for (const m of photoMatches) {
    const url = m[1];
    // Skip Airbnb's review-synthesis / category-decoration platform assets.
    if (url.includes("/AirbnbPlatformAssets/")) continue;
    if (url.includes("/AirCover/")) continue; // AirCover badge graphics
    if (url.includes("/Categories/")) continue; // category-page illustrations
    if (url.includes("/badge/") || url.includes("/badges/")) continue;
    if (photoSet.size < 30) photoSet.add(url);
  }
  const photos = [...photoSet];

  // ─── Host ──────────────────────────────────────────────────────────────
  const isSuperhost = /"isSuperhost":\s*true/.test(html);
  const hostName =
    matchAttr(html, /"hostName":"([^"]{1,80})"/) ||
    matchAttr(html, /"host"\s*:\s*\{[^}]*"name":"([^"]{1,80})"/) ||
    null;

  // ─── Rating + reviews ──────────────────────────────────────────────────
  const starRating = parseFloatOrNull(
    matchAttr(html, /"starRating":\s*([0-9]+(?:\.[0-9]+)?)/) ??
      matchAttr(html, /"guestSatisfactionOverall":\s*([0-9]+(?:\.[0-9]+)?)/),
  );
  const reviewCount = parseIntOrNull(
    matchAttr(html, /"reviewCount":\s*([0-9]+)/) ??
      matchAttr(html, /"reviewsCount":\s*([0-9]+)/),
  );

  // ─── Location: city from "location":"...", state via og:title parsing ──
  const city =
    matchAttr(html, /"smartLocation":"([^"]{1,80})"/) ||
    matchAttr(html, /"location":"([^"]{1,80})"/) ||
    matchAttr(html, /"city":"([^"]{1,80})"/) ||
    "";
  // og:title looks like "Condo in Austin · ★4.97 · 1 bedroom"
  // Extract state from og:title or rely on city alone for v1.
  let state = "";
  const placeMatch = ogTitle?.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s+·|\s*$)/);
  if (placeMatch) {
    // placeMatch[1] could be "Austin" or "Austin, TX" — try abbreviating later
    const place = placeMatch[1].trim();
    const stateMatch = place.match(/,\s*([A-Z]{2})$/);
    if (stateMatch) state = stateMatch[1];
  }

  // ─── Capacity / property type ──────────────────────────────────────────
  // og:title includes bed counts; bedrooms/baths
  const bedroomMatch = ogTitle?.match(/(\d+)\s+bedroom/i);
  const bathroomMatch = ogTitle?.match(/(\d+(?:\.\d+)?)\s+(?:private\s+)?bath/i);
  const guestMatch = ogTitle?.match(/(\d+)\s+guests?/i);

  const propertyType = ogTitle?.match(/^([A-Z][a-z]+)\s+in\s+/)?.[1]; // "Condo", "Loft", etc.

  return {
    source: "airbnb",
    sourceId,
    mlsId: sourceId,
    address: city, // pre-booking we don't get a real street; use city as approximate
    city,
    state,
    zip: "",
    price: 0, // filled by comp-pricing later
    listingType: propertyType?.toLowerCase().includes("entire") ? "entire_home" : "other",
    photos,
    agentName: hostName ?? undefined,
    reviewCount: reviewCount ?? undefined,
    avgRating: starRating ?? undefined,
    isSuperhost,
    bedrooms: parseIntOrNull(bedroomMatch?.[1]) ?? undefined,
    bathrooms: parseFloatOrNull(bathroomMatch?.[1]) ?? undefined,
    guestCapacity: parseIntOrNull(guestMatch?.[1]) ?? undefined,
    listingUrl: `https://www.airbnb.com/rooms/${sourceId}`,
    scrapedTitle: title || undefined,
    scrapedDescription: description || undefined,
  };
}

function extractListingId(url: string): string | null {
  const m =
    url.match(/\/rooms\/(?:plus\/)?(\d+)/) ??
    url.match(/\/h\/[\w-]+\/(\d+)/) ??
    url.match(/\/(\d{6,})/);
  return m ? m[1] : null;
}

function matchAttr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function parseIntOrNull(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
