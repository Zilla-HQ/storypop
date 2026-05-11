/**
 * Retargeting setup, take 2. The first version tried /copies?deep_copy=true
 * which Meta rejects when the source ad set has more than 2 underlying
 * objects. This version:
 *
 *   1. Reuses the audience already created (id 52546835721992)
 *   2. Pulls the source ad set's targeting + the existing ads' creative IDs
 *   3. Builds a fresh ad set with the warm-visitor audience + same
 *      promoted-object/optimization config
 *   4. Creates a single ad in the new set referencing the strongest
 *      existing creative
 *
 *   npx tsx --env-file=.env.local scripts/meta-create-retargeting-v2.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-create-retargeting-v2.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

const AUDIENCE_ID = "52546835721992"; // pre-created warm-visitors audience
const SOURCE_ADSET_ID = "52544541002392"; // "Restay — Leads — Interest stack"
const LEADS_CAMPAIGN_ID = "52544540986192";

async function ggets<T>(path: string, fields: string): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("fields", fields);
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`GET ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

async function gpost<T = { id: string }>(path: string, body: Record<string, string>): Promise<T> {
  if (dryRun) {
    console.log(`[dry] POST ${path}`);
    for (const [k, v] of Object.entries(body)) {
      const display = v.length > 220 ? v.slice(0, 220) + "…" : v;
      console.log(`         ${k}: ${display}`);
    }
    return { id: "dry-run" } as T;
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) params.set(k, v);
  const r = await fetch(url, { method: "POST", body: params, cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`POST ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

interface SourceAdSet {
  id: string;
  name: string;
  targeting: Record<string, unknown>;
  optimization_goal: string;
  billing_event: string;
  bid_strategy?: string;
  destination_type?: string;
  promoted_object?: Record<string, unknown>;
  attribution_spec?: Array<Record<string, unknown>>;
  start_time?: string;
}
interface AdsList {
  data: Array<{ id: string; name: string; status: string; effective_status: string; creative: { id: string }; insights?: { data?: Array<{ ctr?: string; spend?: string }> } }>;
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Retargeting v2 — manual rebuild\n`);

  // ─── 1. Pull source ad set targeting/config ──────────────────────────
  console.log("1. Pulling source ad set config…");
  const srcFields = [
    "id",
    "name",
    "targeting",
    "optimization_goal",
    "billing_event",
    "bid_strategy",
    "destination_type",
    "promoted_object",
    "attribution_spec",
    "start_time",
  ].join(",");
  const src = await ggets<SourceAdSet>(`/${SOURCE_ADSET_ID}`, srcFields);
  console.log(`   src.optimization_goal=${src.optimization_goal}  billing_event=${src.billing_event}`);

  // ─── 2. Pull ads under the source set, pick the highest-CTR one ──────
  console.log("\n2. Picking strongest creative under source ad set…");
  const adsRes = await ggets<AdsList>(
    `/${SOURCE_ADSET_ID}/ads`,
    "id,name,status,effective_status,creative,insights.date_preset(maximum){ctr,spend}",
  );
  const candidates = (adsRes.data ?? []).filter((a) => a.effective_status !== "DELETED");
  candidates.sort((a, b) => Number(b.insights?.data?.[0]?.ctr ?? 0) - Number(a.insights?.data?.[0]?.ctr ?? 0));
  const winner = candidates[0];
  if (!winner) throw new Error("no ads in source set to clone creative from");
  console.log(`   winner: ad=${winner.id} creative=${winner.creative.id} CTR=${winner.insights?.data?.[0]?.ctr ?? "?"}%`);

  // ─── 3. Build retargeting targeting JSON ─────────────────────────────
  // Take the source targeting as base, swap interests for the custom audience,
  // keep geo + age + placements.
  const baseTargeting = src.targeting ?? {};
  const newTargeting = {
    ...baseTargeting,
    custom_audiences: [{ id: AUDIENCE_ID }],
    // Wipe interest-based filters — retargeting is audience-only.
    flexible_spec: undefined,
    interests: undefined,
    behaviors: undefined,
  };

  // ─── 4. Create the new ad set ─────────────────────────────────────────
  // The Leads campaign uses CBO (campaign-level budget at $50/day) — so the
  // ad set MUST omit daily_budget. CBO will redistribute as retargeting proves
  // out. Bumping the campaign-level budget up to $75/day to make room.
  console.log("\n3a. Bumping Leads campaign $50 → $75/day to make room for retargeting…");
  await gpost(`/${LEADS_CAMPAIGN_ID}`, { daily_budget: "7500" });
  console.log("3b. Creating retargeting ad set in Leads campaign (CBO, paused for review)…");
  const newAdSet = await gpost<{ id: string }>(`/${ACCT}/adsets`, {
    name: "Restay — Leads — Retargeting (warm 30d)",
    campaign_id: LEADS_CAMPAIGN_ID,
    billing_event: src.billing_event,
    optimization_goal: src.optimization_goal,
    ...(src.bid_strategy ? { bid_strategy: src.bid_strategy } : {}),
    ...(src.destination_type ? { destination_type: src.destination_type } : {}),
    ...(src.promoted_object ? { promoted_object: JSON.stringify(src.promoted_object) } : {}),
    targeting: JSON.stringify(newTargeting),
    status: "PAUSED",
    start_time: new Date().toISOString(),
  });
  console.log(`   new_adset_id=${newAdSet.id}`);

  // ─── 5. Create one ad in the new set referencing the winning creative ─
  console.log("\n4. Creating ad in retargeting set with winning creative…");
  const newAd = await gpost<{ id: string }>(`/${ACCT}/ads`, {
    name: "Restay — Retargeting — winner clone",
    adset_id: newAdSet.id,
    creative: JSON.stringify({ creative_id: winner.creative.id }),
    status: "PAUSED",
  });
  console.log(`   new_ad_id=${newAd.id}`);

  console.log(`\n✓ Retargeting ad set built (PAUSED — review then activate)`);
  console.log(`   campaign:    ${LEADS_CAMPAIGN_ID}`);
  console.log(`   ad set id:   ${newAdSet.id}`);
  console.log(`   ad id:       ${newAd.id}`);
  console.log(`   audience id: ${AUDIENCE_ID}  (warm visitors 30d, no checkout)`);
  console.log(`   budget:      shared CBO @ $75/day across both ad sets`);
  console.log(`\n   To activate:`);
  console.log(`     curl -X POST 'https://graph.facebook.com/v22.0/${newAdSet.id}?access_token=$META_ADS_ACCESS_TOKEN&status=ACTIVE'`);
  console.log(`     curl -X POST 'https://graph.facebook.com/v22.0/${newAd.id}?access_token=$META_ADS_ACCESS_TOKEN&status=ACTIVE'`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
