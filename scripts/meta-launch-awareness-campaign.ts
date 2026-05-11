/**
 * Launch a low-cost AWARENESS campaign — cheap impressions broaden
 * the Pixel's PageView event base, which feeds the existing
 * retargeting + lookalike audiences. Awareness CPM is typically 3-5×
 * cheaper than TRAFFIC CPC, so the same dollar grows our warm pool
 * faster.
 *
 * Single ad set, broad US, $25/day, same proven video creative.
 *
 *   npx tsx --env-file=.env.local scripts/meta-launch-awareness-campaign.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-launch-awareness-campaign.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PAGE_ID = env("META_PAGE_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

const APP_URL = "https://restay.agency";
const WINNING_VIDEO_ID = "25193588457006055";
const DAILY_CENTS = 2500;

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

async function getThumbnailUrl(videoId: string): Promise<string> {
  const r = await gget<{ data?: Array<{ uri: string; is_preferred?: boolean }> }>(
    `/${videoId}/thumbnails`,
  );
  const preferred = r.data?.find((t) => t.is_preferred) ?? r.data?.[0];
  if (!preferred) throw new Error("no thumbnail");
  return preferred.uri;
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Launching Awareness campaign\n`);

  const todaySlug = new Date().toISOString().slice(0, 10);
  const campName = `Restay — Awareness — ${todaySlug}`;

  // Idempotent campaign
  const existing = await gget<{ data: Array<{ id: string; name: string }> }>(
    `/${ACCT}/campaigns`,
    { fields: "id,name", limit: "100" },
  );
  let camp: { id: string };
  const found = existing.data.find((c) => c.name === campName);
  if (found) {
    console.log(`reusing campaign_id=${found.id}`);
    camp = { id: found.id };
  } else {
    camp = await gpost<{ id: string }>(`/${ACCT}/campaigns`, {
      name: campName,
      objective: "OUTCOME_AWARENESS",
      status: "ACTIVE",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
    });
    console.log(`created campaign_id=${camp.id}`);
  }

  const targeting = {
    geo_locations: { countries: ["US"] },
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

  // Idempotent ad set
  const adsetName = "Restay — Awareness — broad US";
  const existingAdsets = await gget<{ data: Array<{ id: string; name: string }> }>(
    `/${camp.id}/adsets`,
    { fields: "id,name", limit: "100" },
  );
  if (existingAdsets.data.some((a) => a.name === adsetName)) {
    console.log("ad set already exists — skipping");
    return;
  }

  const adset = await gpost<{ id: string }>(`/${ACCT}/adsets`, {
    name: adsetName,
    campaign_id: camp.id,
    daily_budget: String(DAILY_CENTS),
    billing_event: "IMPRESSIONS",
    optimization_goal: "REACH",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(targeting),
    status: "ACTIVE",
    start_time: new Date().toISOString(),
  });
  console.log(`adset_id=${adset.id}`);

  const thumb = dryRun ? "<dry>" : await getThumbnailUrl(WINNING_VIDEO_ID);
  const destUrl = new URL(APP_URL);
  destUrl.searchParams.set("utm_source", "meta");
  destUrl.searchParams.set("utm_medium", "paid_social");
  destUrl.searchParams.set("utm_campaign", "awareness_v1");
  destUrl.searchParams.set("utm_content", "broad_us");

  const objectStorySpec = {
    page_id: PAGE_ID,
    video_data: {
      video_id: WINNING_VIDEO_ID,
      title: "Free Airbnb Listing Grader",
      message:
        "Most Airbnb listings haven't been refreshed in over a year. Restay grades yours in 10 seconds — copy, photos, signals — free. Then we offer a $79 one-time done-for-you Tune-Up if you want the work done.",
      image_url: thumb,
      call_to_action: { type: "LEARN_MORE", value: { link: destUrl.toString() } },
    },
  };

  const creative = await gpost<{ id: string }>(`/${ACCT}/adcreatives`, {
    name: "Restay creative — awareness/broad",
    object_story_spec: objectStorySpec,
  });
  const ad = await gpost<{ id: string }>(`/${ACCT}/ads`, {
    name: "Restay — awareness/broad",
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "ACTIVE",
  });
  console.log(`creative=${creative.id}  ad=${ad.id}`);

  console.log(`\n✓ Awareness campaign live at $${DAILY_CENTS / 100}/day.`);
  console.log(`   Pixel events from this campaign feed the warm-visitors retargeting audience.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
