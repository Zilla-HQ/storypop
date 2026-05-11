/**
 * One-shot: launch the OUTCOME_LEADS v1 campaign with 2 ad sets.
 *
 * Creates everything PAUSED. After running, save the printed IDs into env:
 *   META_LEAD_CAMPAIGN_ID=<campaign_id>
 * The lead-scaler Inngest function reads that to know which campaign to manage.
 *
 *   npx tsx scripts/meta-launch-campaign.ts
 *
 * Re-running creates duplicates. Only run once.
 *
 * Edit the constants at the top to customize: campaign name, starting budget,
 * geo/age targeting, interest stack for ad set B.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const ACCOUNT_RAW = process.env.META_AD_ACCOUNT_ID!;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID!;
const V = process.env.META_API_VERSION || "v19.0";
const BASE = `https://graph.facebook.com/${V}`;

if (!TOKEN || !ACCOUNT_RAW || !PIXEL_ID) {
  console.error("Need META_ADS_ACCESS_TOKEN, META_AD_ACCOUNT_ID, NEXT_PUBLIC_META_PIXEL_ID");
  process.exit(1);
}
const ACCOUNT = ACCOUNT_RAW.startsWith("act_") ? ACCOUNT_RAW : `act_${ACCOUNT_RAW}`;

// --- Customize per merchant ---
const CAMPAIGN_NAME = "v1 — Lead optimization";
const DAILY_BUDGET_CENTS = 7500; // $75/day CBO; the lead-scaler will grow this

const ADSET_A_NAME = "A — Advantage+ broad US 25+";
const ADSET_A_GEO = ["US"];
const ADSET_A_AGE_MIN = 25;
const ADSET_A_AGE_MAX = 65;

const ADSET_B_NAME = "B — interest stack";
const ADSET_B_GEO = ["US"];
const ADSET_B_AGE_MIN = 28;
const ADSET_B_AGE_MAX = 65;
// These names are looked up via Meta's adinterest search. Edit per vertical.
const ADSET_B_INTEREST_NAMES = ["Wix.com", "Squarespace", "GoDaddy", "Small business", "Entrepreneurship"];
// ---

async function post(path: string, body: Record<string, any>) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const j: any = await res.json();
  if (j.error) throw new Error(`${path}: ${j.error.message} (${j.error.error_subcode || j.error.code})`);
  return j;
}

async function get(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", TOKEN);
  const r = await fetch(u.toString());
  const j: any = await r.json();
  if (j.error) throw new Error(`${path}: ${j.error.message}`);
  return j;
}

async function findInterest(name: string): Promise<{ id: string; name: string } | null> {
  try {
    const j = await get("search", { type: "adinterest", q: name, limit: "1" });
    return j.data?.[0] || null;
  } catch { return null; }
}

async function main() {
  console.log(`Account: ${ACCOUNT}`);
  console.log(`Pixel:   ${PIXEL_ID}`);
  console.log(`Budget:  $${DAILY_BUDGET_CENTS / 100}/day (CBO)\n`);

  console.log("→ Creating campaign...");
  const campaign = await post(`${ACCOUNT}/campaigns`, {
    name: CAMPAIGN_NAME,
    // OUTCOME_LEADS — required when optimizing on the Lead pixel event.
    // For Purchase optimization use OUTCOME_SALES (needs ~50 Purchases/wk).
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
    daily_budget: DAILY_BUDGET_CENTS,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  });
  console.log(`  campaign id: ${campaign.id}`);

  console.log("\n→ Looking up ad targeting interests...");
  const interests = (await Promise.all(ADSET_B_INTEREST_NAMES.map(findInterest))).filter(Boolean) as { id: string; name: string }[];
  for (const i of interests) console.log(`  ✓ ${i.name} (${i.id})`);

  const promotedObject = { pixel_id: PIXEL_ID, custom_event_type: "LEAD" };

  console.log(`\n→ Creating Ad Set A (${ADSET_A_NAME})...`);
  const adsetA = await post(`${ACCOUNT}/adsets`, {
    name: ADSET_A_NAME,
    campaign_id: campaign.id,
    status: "PAUSED",
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    promoted_object: promotedObject,
    targeting: {
      geo_locations: { countries: ADSET_A_GEO },
      age_min: ADSET_A_AGE_MIN,
      age_max: ADSET_A_AGE_MAX,
      // advantage_audience:1 = let Meta find buyers wherever it can (broad)
      targeting_automation: { advantage_audience: 1 },
    },
  });
  console.log(`  ad set A id: ${adsetA.id}`);

  console.log(`\n→ Creating Ad Set B (${ADSET_B_NAME})...`);
  const adsetB = await post(`${ACCOUNT}/adsets`, {
    name: ADSET_B_NAME,
    campaign_id: campaign.id,
    status: "PAUSED",
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    promoted_object: promotedObject,
    targeting: {
      geo_locations: { countries: ADSET_B_GEO },
      age_min: ADSET_B_AGE_MIN,
      age_max: ADSET_B_AGE_MAX,
      // advantage_audience:0 = strict targeting, no expansion past the interests
      targeting_automation: { advantage_audience: 0 },
      flexible_spec: interests.length ? [{ interests: interests.map(i => ({ id: i.id, name: i.name })) }] : undefined,
    },
  });
  console.log(`  ad set B id: ${adsetB.id}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CREATED — all PAUSED, no spend until you unpause");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nCampaign: ${campaign.id}`);
  console.log(`Ad set A: ${adsetA.id}  (Advantage+ broad)`);
  console.log(`Ad set B: ${adsetB.id}  (interest stack)`);
  console.log(`\nhttps://business.facebook.com/adsmanager/manage/campaigns?act=${ACCOUNT_RAW}&selected_campaign_ids=${campaign.id}`);

  console.log("\nNext steps:");
  console.log(`  1. Save into .env: META_LEAD_CAMPAIGN_ID=${campaign.id}`);
  console.log(`  2. Upload your video creative: npx tsx scripts/meta-upload-page-video.ts <video.mp4>`);
  console.log(`  3. Create ads (4 copy variants × 2 ad sets): edit + run scripts/meta-create-ads.ts`);
  console.log(`  4. Spot-check in Ads Manager, then unpause campaign → ad sets → ads.\n`);
}

main().catch(e => { console.error("\nFAILED:", e.message); process.exit(1); });
