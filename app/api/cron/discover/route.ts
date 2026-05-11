import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/db/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Vercel cron entrypoint for cold-outreach discovery. Schedule lives in
 * vercel.json (`0 STAR/6 STAR STAR STAR` — every 6 hours).
 *
 * Auth: Vercel auto-sends `Authorization: Bearer <CRON_SECRET>`. Manual
 * calls without the bearer (e.g. smoke tests) are still allowed when
 * CRON_SECRET is unset.
 *
 * Behavior: fan out to two discovery sources in parallel.
 *   1. URL-based: scrape directory pages from DISCOVERY_SEED_URLS
 *      (Eater "best of" lists, etc.) → /api/discover
 *   2. Yelp-based: query Apify's Yelp scraper for (term, location) pairs
 *      → /api/discover/yelp. Falls back to a built-in default term ×
 *      location list if YELP_DISCOVERY_TERMS / _LOCATIONS aren't set, so
 *      a fresh deploy starts shipping outreach immediately.
 *
 * Both sources dedupe at the sites table — same URL never gets contacted
 * twice across runs (sites.site_url unique constraint).
 *
 * Pause flags: skips entirely if `paused` or `discoveryPaused` is set on
 * admin_settings. Toggle on /admin/settings.
 */

// ICP-focused list (refined 2026-05-07 after the first 92-email batch
// hit 0% paid conversion). Restaurants, salons, fitness, hospitality,
// and low-margin trade services were dropped — they don't pay $29/mo
// for SEO monitoring; they care about Google Maps and Instagram, not
// the kind of regression alerts Sitebeat sends. Replaced with higher-
// margin one-person-businesses + professional services where the
// owner sets their own marketing budget and feels SEO pain directly
// (drop in inbound = drop in revenue, immediately visible). Indie
// SaaS / e-commerce ICPs are NOT well-served by Yelp; sourcing for
// those needs a different scraper (IndieHackers / PH new launches /
// Shopify-store directories) — TODO once Apify credits allow.
const DEFAULT_YELP_TERMS = [
  // Marketing / web professionals — they get SEO, often pay, often refer clients
  "marketing agency",
  "web design",
  "digital marketing agency",
  "seo consultant",
  "branding agency",
  "graphic designer",
  // Accounting / financial — high $29/mo tolerance, paid websites
  "accountant",
  "cpa",
  "tax preparation",
  "bookkeeping",
  "financial advisor",
  "insurance agency",
  "wealth management",
  // Legal — high revenue per case, sensitive to local-SEO regressions
  "law firm",
  "personal injury lawyer",
  "estate planning attorney",
  "family law attorney",
  // Health professionals — small private practices with their own websites
  "dentist",
  "orthodontist",
  "chiropractor",
  "physical therapy",
  "veterinarian",
  "dermatologist",
  "med spa",
  "optometrist",
  // Real estate professionals — own marketing budget, paid websites
  "real estate agent",
  "real estate broker",
  "mortgage broker",
  "home inspector",
  // Premium trades / specialty contractors (high-margin, not low-end)
  "interior designer",
  "architect",
  "general contractor",
  "kitchen remodeling",
  "bathroom remodeling",
  "custom home builder",
  // 1:1 service professionals with paid websites
  "business coach",
  "executive coach",
  "personal trainer",
  "wedding photographer",
  "commercial photographer",
];

const DEFAULT_YELP_LOCATIONS = [
  // Top 20 metros — saturated but high-density
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "Austin, TX",
  "San Francisco, CA",
  "Seattle, WA",
  "Boston, MA",
  "Denver, CO",
  "Atlanta, GA",
  "Miami, FL",
  "Portland, OR",
  "Nashville, TN",
  "Charlotte, NC",
  "Minneapolis, MN",
  // Mid-tier metros — less competition for cold outreach attention,
  // SMB owners more responsive to a personal-feeling email. These
  // were added 2026-05-07 because the top-20 batch saturated quickly.
  "Indianapolis, IN",
  "Columbus, OH",
  "Pittsburgh, PA",
  "Cincinnati, OH",
  "Cleveland, OH",
  "Kansas City, MO",
  "St. Louis, MO",
  "Salt Lake City, UT",
  "Sacramento, CA",
  "Tampa, FL",
  "Orlando, FL",
  "Jacksonville, FL",
  "Raleigh, NC",
  "Richmond, VA",
  "Albany, NY",
  "Hartford, CT",
  "Madison, WI",
  "Des Moines, IA",
  "Boise, ID",
  "Spokane, WA",
];

// Partner-discovery defaults: businesses on Yelp that *manage* SEO for
// others (the partner ICP) — agencies, freelancers, marketing
// consultants. Override via PARTNER_DISCOVERY_TERMS / _LOCATIONS env.
const DEFAULT_PARTNER_TERMS = [
  "web design agency",
  "seo consultant",
  "digital marketing agency",
  "marketing consultant",
  "wordpress developer",
];

const DEFAULT_PARTNER_LOCATIONS = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Austin, TX",
  "San Francisco, CA",
  "Seattle, WA",
  "Boston, MA",
  "Denver, CO",
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Honor the admin kill-switches. `paused` is the global emergency
  // stop; `discoveryPaused` lets the operator keep monitoring on while
  // pausing outbound prospecting (e.g. during a Resend deliverability
  // investigation).
  const settings = await getSettings().catch(() => null);
  if (settings?.paused) {
    return NextResponse.json({ skipped: true, reason: "global pause" });
  }
  if (settings?.discoveryPaused) {
    return NextResponse.json({ skipped: true, reason: "discovery_paused" });
  }

  const outreachSecret = process.env.OUTREACH_SECRET;
  if (!outreachSecret) {
    return NextResponse.json({ error: "OUTREACH_SECRET not set" }, { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const ranAt = new Date().toISOString();

  // Source 1: URL-based discovery (env-only — no built-in defaults
  // because directory pages are too domain-specific to guess).
  const seedRaw = process.env.DISCOVERY_SEED_URLS ?? "";
  const seeds = seedRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const perSeedMax = Math.max(1, Number(process.env.DISCOVERY_PER_SEED_MAX ?? "12"));

  const urlSourcePromise: Promise<Record<string, unknown>> =
    seeds.length > 0
      ? fetch(`${origin}/api/discover`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${outreachSecret}`,
          },
          body: JSON.stringify({ seedUrls: seeds, maxPerSeed: perSeedMax }),
        })
          .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
          .catch((e) => ({ status: 0, error: String(e) }))
      : Promise.resolve({ skipped: true, reason: "DISCOVERY_SEED_URLS not set" });

  // Source 2: Yelp-based discovery. Falls back to built-in defaults so
  // a vanilla deploy ships outreach the first time the cron fires.
  const termsRaw = process.env.YELP_DISCOVERY_TERMS ?? "";
  const locsRaw = process.env.YELP_DISCOVERY_LOCATIONS ?? "";
  const envTerms = termsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const envLocations = locsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const terms = envTerms.length > 0 ? envTerms : DEFAULT_YELP_TERMS;
  const locations = envLocations.length > 0 ? envLocations : DEFAULT_YELP_LOCATIONS;

  // Apify (the Yelp scraper backend) requires APIFY_TOKEN to be set on
  // the project — without it, the call fails with a 401. We gate on
  // either APIFY_TOKEN or YELP_API_KEY (legacy Fusion path) so we don't
  // burn a fetch round-trip just to fail.
  const yelpReady = Boolean(process.env.APIFY_TOKEN ?? process.env.YELP_API_KEY);
  const yelpSourcePromise: Promise<Record<string, unknown>> = yelpReady
    ? fetch(`${origin}/api/discover/yelp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${outreachSecret}`,
        },
        body: JSON.stringify({ terms, locations, perCallLimit: 30 }),
      })
        .then(async (r) => ({
          status: r.status,
          body: await r.json().catch(() => ({})),
          termsUsed: terms.length,
          locationsUsed: locations.length,
          usedDefaults: envTerms.length === 0 || envLocations.length === 0,
        }))
        .catch((e) => ({ status: 0, error: String(e) }))
    : Promise.resolve({ skipped: true, reason: "neither APIFY_TOKEN nor YELP_API_KEY set" });

  // Source 3: Partner discovery — separate Yelp fan-out targeting
  // agencies & freelancers, feeds into partner_outreach instead of
  // the audit pipeline. Runs every cron tick but only processes
  // ~100 URLs per run (capped server-side) so the load is modest.
  const partnerTermsRaw = process.env.PARTNER_DISCOVERY_TERMS ?? "";
  const partnerLocsRaw = process.env.PARTNER_DISCOVERY_LOCATIONS ?? "";
  const envPartnerTerms = partnerTermsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const envPartnerLocations = partnerLocsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const partnerTerms = envPartnerTerms.length > 0 ? envPartnerTerms : DEFAULT_PARTNER_TERMS;
  const partnerLocations = envPartnerLocations.length > 0 ? envPartnerLocations : DEFAULT_PARTNER_LOCATIONS;
  const partnerAutoSend = (process.env.PARTNER_AUTO_SEND ?? "true").toLowerCase() !== "false";

  const partnerSourcePromise: Promise<Record<string, unknown>> = yelpReady
    ? fetch(`${origin}/api/partner-discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${outreachSecret}`,
        },
        body: JSON.stringify({
          terms: partnerTerms,
          locations: partnerLocations,
          perCallLimit: 30,
          autoSend: partnerAutoSend,
        }),
      })
        .then(async (r) => ({
          status: r.status,
          body: await r.json().catch(() => ({})),
          termsUsed: partnerTerms.length,
          locationsUsed: partnerLocations.length,
        }))
        .catch((e) => ({ status: 0, error: String(e) }))
    : Promise.resolve({ skipped: true, reason: "neither APIFY_TOKEN nor YELP_API_KEY set" });

  const [urlSource, yelpSource, partnerSource] = await Promise.all([
    urlSourcePromise,
    yelpSourcePromise,
    partnerSourcePromise,
  ]);

  return NextResponse.json({
    ranAt,
    sources: { urls: urlSource, yelp: yelpSource, partners: partnerSource },
  });
}
