/**
 * Launch "Restay City Markets v1" — a TRAFFIC-objective campaign with
 * one ad set per high-density Airbnb market, each pointing at the
 * corresponding /host/[city] programmatic landing page.
 *
 * Why a separate campaign vs more ad sets in Leads CBO: city targeting
 * narrows the audience hard (Nashville is ~150k people who travel-host
 * vs Leads' broad US ~50M). CBO redistributes by performance — broad
 * audiences would always starve narrow ones. Separate campaigns give
 * each city its own learning budget.
 *
 *   npx tsx --env-file=.env.local scripts/meta-launch-city-campaign.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-launch-city-campaign.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PAGE_ID = env("META_PAGE_ID")!;
const PIXEL_ID = env("NEXT_PUBLIC_META_PIXEL_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

const APP_URL = "https://restay.agency";
const WINNING_VIDEO_ID = "25193588457006055";

interface CityTarget {
  slug: string;
  name: string;
  /** Meta location ID; resolved at run-time via /search?type=adgeolocation */
  // (we use city + state in the search query)
  state: string;
}

const CITIES: CityTarget[] = [
  { slug: "nashville", name: "Nashville", state: "TN" },
  { slug: "austin", name: "Austin", state: "TX" },
  { slug: "miami", name: "Miami", state: "FL" },
  { slug: "new-york", name: "New York", state: "NY" },
  { slug: "los-angeles", name: "Los Angeles", state: "CA" },
  { slug: "scottsdale", name: "Scottsdale", state: "AZ" },
];

const PER_CITY_DAILY_CENTS = 1000; // $10/day each
const TOTAL_DAILY_USD = (CITIES.length * PER_CITY_DAILY_CENTS) / 100;

async function gget<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`GET ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

async function gpost<T = { id: string }>(path: string, body: Record<string, unknown>): Promise<T> {
  if (dryRun) {
    console.log(`[dry] POST ${path}`);
    for (const [k, v] of Object.entries(body)) {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      console.log(`         ${k}: ${s.length > 220 ? s.slice(0, 220) + "…" : s}`);
    }
    return { id: "dry-run" } as T;
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    params.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const r = await fetch(url, { method: "POST", body: params, cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`POST ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

interface GeoSearchResult {
  data: Array<{ key: string; name: string; type: string; region?: string; country_code?: string }>;
}

async function resolveCityKey(name: string, state: string): Promise<string> {
  const r = await gget<GeoSearchResult>(`/search`, {
    type: "adgeolocation",
    location_types: '["city"]',
    q: name,
    country_code: "US",
    limit: "10",
  });
  // Pick the entry whose region matches the state.
  const stateMatch = r.data.find((d) => d.region?.toLowerCase().startsWith(state.toLowerCase()));
  const fallback = r.data[0];
  const pick = stateMatch ?? fallback;
  if (!pick) throw new Error(`No geo match for ${name}, ${state}`);
  return pick.key;
}

async function getThumbnailUrl(videoId: string): Promise<string> {
  const r = await gget<{ data?: Array<{ uri: string; is_preferred?: boolean }> }>(
    `/${videoId}/thumbnails`,
  );
  const preferred = r.data?.find((t) => t.is_preferred) ?? r.data?.[0];
  if (!preferred) throw new Error("no thumbnail");
  return preferred.uri;
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Launching "Restay City Markets v1"`);
  console.log(`  ${CITIES.length} cities × $${(PER_CITY_DAILY_CENTS / 100).toFixed(2)}/day = $${TOTAL_DAILY_USD}/day total\n`);

  // ─── 1. Create campaign (TRAFFIC, ABO at ad-set level) ────────────────
  // Idempotent: reuse existing campaign by name if a prior run created it.
  console.log("1. Creating/finding campaign…");
  const todaySlug = new Date().toISOString().slice(0, 10);
  const wantedName = `Restay — City Markets v1 — ${todaySlug}`;
  const existing = await gget<{ data: Array<{ id: string; name: string }> }>(
    `/${ACCT}/campaigns`,
    { fields: "id,name", limit: "100" },
  );
  const found = existing.data.find((c) => c.name === wantedName);
  let camp: { id: string };
  if (found) {
    console.log(`   reusing existing campaign_id=${found.id}`);
    camp = { id: found.id };
  } else {
    camp = await gpost<{ id: string }>(`/${ACCT}/campaigns`, {
      name: wantedName,
      objective: "OUTCOME_TRAFFIC",
      status: "ACTIVE",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
    });
    console.log(`   created campaign_id=${camp.id}`);
  }

  // ─── 2. Resolve city → Meta geo keys ──────────────────────────────────
  console.log("\n2. Resolving city geo keys…");
  const geoKeys: Record<string, string> = {};
  for (const c of CITIES) {
    if (dryRun) {
      geoKeys[c.slug] = "<dry-key>";
      console.log(`   [dry] ${c.name}, ${c.state} → <dry-key>`);
      continue;
    }
    const k = await resolveCityKey(c.name, c.state);
    geoKeys[c.slug] = k;
    console.log(`   ${c.name}, ${c.state} → ${k}`);
  }

  const thumb = dryRun ? "<dry>" : await getThumbnailUrl(WINNING_VIDEO_ID);

  // ─── 3. For each city: ad set + ad ────────────────────────────────────
  // Skip cities whose ad set already exists by name (idempotent re-run).
  console.log("\n3. Creating ad sets + ads…");
  const existingAdsets = await gget<{ data: Array<{ id: string; name: string }> }>(
    `/${camp.id}/adsets`,
    { fields: "id,name", limit: "100" },
  );
  const existingNames = new Set(existingAdsets.data.map((a) => a.name));

  for (const c of CITIES) {
    const adsetName = `Restay — ${c.name} hosts`;
    if (existingNames.has(adsetName)) {
      console.log(`\n  → ${c.name}  (skip — ad set already exists)`);
      continue;
    }
    console.log(`\n  → ${c.name}`);
    const targeting = {
      geo_locations: { cities: [{ key: geoKeys[c.slug], radius: 25, distance_unit: "mile" }] },
      age_min: 25,
      age_max: 65,
      flexible_spec: [
        {
          interests: [
            { id: "6003252231836", name: "Airbnb" },
            { id: "6003175542014", name: "Vacation rental" },
            { id: "6003446239080", name: "Real estate investing" },
            { id: "6003365135251", name: "Property management" },
          ],
        },
      ],
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed", "marketplace", "story"],
      instagram_positions: ["stream", "story", "explore", "reels"],
      device_platforms: ["mobile", "desktop"],
      targeting_automation: { advantage_audience: 0 },
    };

    const adset = await gpost<{ id: string }>(`/${ACCT}/adsets`, {
      name: adsetName,
      campaign_id: camp.id,
      daily_budget: String(PER_CITY_DAILY_CENTS),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LANDING_PAGE_VIEWS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(targeting),
      status: "ACTIVE",
      start_time: new Date().toISOString(),
    });
    console.log(`     adset_id=${adset.id}`);

    const destUrl = new URL(`${APP_URL}/host/${c.slug}`);
    destUrl.searchParams.set("utm_source", "meta");
    destUrl.searchParams.set("utm_medium", "paid_social");
    destUrl.searchParams.set("utm_campaign", "city_markets_v1");
    destUrl.searchParams.set("utm_content", c.slug);

    const objectStorySpec = {
      page_id: PAGE_ID,
      video_data: {
        video_id: WINNING_VIDEO_ID,
        title: `${c.name} Airbnb Tune-Up — $79`,
        message: `Airbnb hosts in ${c.name} — the comp set has gotten sharper. We rewrite your title + description, restyle 10 photos, and ship a 30-day pricing report tuned to ${c.name} comps. $79 one-time, delivered in 4 hours.`,
        image_url: thumb,
        call_to_action: { type: "GET_OFFER", value: { link: destUrl.toString() } },
      },
    };

    const creative = await gpost<{ id: string }>(`/${ACCT}/adcreatives`, {
      name: `Restay creative — city/${c.slug}`,
      object_story_spec: objectStorySpec,
    });
    const ad = await gpost<{ id: string }>(`/${ACCT}/ads`, {
      name: `Restay — city/${c.slug}`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "ACTIVE",
    });
    console.log(`     creative=${creative.id}  ad=${ad.id}`);
  }

  console.log(`\n✓ City Markets v1 launched.`);
  console.log(`   campaign_id: ${camp.id}`);
  console.log(`   ${CITIES.length} ad sets, all ACTIVE.`);
  console.log(`   Daily ceiling: $${TOTAL_DAILY_USD}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
