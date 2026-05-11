/**
 * Spawn 1% and 3% Lookalike Audiences seeded from our InitiateCheckout
 * Pixel events — i.e. people who got far enough into our funnel to
 * hit Stripe. That's the closest signal to "intent to buy" we have
 * (the Purchase event has only 1 firing right now, too small).
 *
 * Then build a fresh ad set in the existing Leads campaign targeting
 * the 1% lookalike. Pause for review; activate after Jack eyeballs.
 *
 *   npx tsx --env-file=.env.local scripts/meta-create-lookalike.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-create-lookalike.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PIXEL_ID = env("NEXT_PUBLIC_META_PIXEL_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

const SOURCE_ADSET_ID = "52544541002392"; // Interest stack — for targeting + creative reference
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
  targeting: Record<string, unknown>;
  optimization_goal: string;
  billing_event: string;
  bid_strategy?: string;
  destination_type?: string;
  promoted_object?: Record<string, unknown>;
}
interface AdsList {
  data: Array<{ id: string; creative: { id: string }; insights?: { data?: Array<{ ctr?: string }> } }>;
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Creating Lookalike audience + targeting ad set\n`);

  // ─── 1. Seed audience: InitiateCheckout firers (Pixel) ───────────────
  console.log("1. Creating seed audience (InitiateCheckout firers, 180d)…");
  const seedRule = {
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ id: PIXEL_ID, type: "pixel" }],
          retention_seconds: 180 * 24 * 60 * 60,
          filter: {
            operator: "and",
            filters: [{ field: "event", operator: "eq", value: "InitiateCheckout" }],
          },
        },
      ],
    },
  };
  const seed = await gpost(`/${ACCT}/customaudiences`, {
    name: "Restay — InitiateCheckout firers (180d) — LAL seed",
    description: "Anyone who hit the Stripe Checkout step in the last 180 days. Used as the lookalike seed.",
    rule: JSON.stringify(seedRule),
    retention_days: "180",
    pixel_id: PIXEL_ID,
  });
  console.log(`   seed_audience_id=${seed.id}`);

  // ─── 2. Spawn 1% Lookalike (US) from that seed ───────────────────────
  console.log("\n2. Creating 1% Lookalike (US) from seed…");
  const lal1 = await gpost(`/${ACCT}/customaudiences`, {
    name: "Restay — Lookalike 1% (US) of InitiateCheckout",
    subtype: "LOOKALIKE",
    origin_audience_id: seed.id,
    lookalike_spec: JSON.stringify({
      type: "similarity",
      ratio: 0.01,
      country: "US",
    }),
  });
  console.log(`   lookalike_1pct_id=${lal1.id}`);

  // ─── 3. Pull source ad set config + winning creative ──────────────────
  console.log("\n3. Pulling source ad set config + winning creative…");
  const src = await ggets<SourceAdSet>(
    `/${SOURCE_ADSET_ID}`,
    "id,targeting,optimization_goal,billing_event,bid_strategy,destination_type,promoted_object",
  );
  const adsRes = await ggets<AdsList>(
    `/${SOURCE_ADSET_ID}/ads`,
    "id,creative,insights.date_preset(maximum){ctr}",
  );
  const winner = (adsRes.data ?? []).sort(
    (a, b) => Number(b.insights?.data?.[0]?.ctr ?? 0) - Number(a.insights?.data?.[0]?.ctr ?? 0),
  )[0];
  if (!winner) throw new Error("no source ad to clone creative from");
  console.log(`   creative=${winner.creative.id}`);

  // ─── 4. Build new ad set targeting the 1% lookalike ──────────────────
  const newTargeting = {
    ...src.targeting,
    custom_audiences: [{ id: lal1.id }],
    // Lookalikes carry their own behavioral signal — strip interests so we
    // don't double-narrow the pool.
    flexible_spec: undefined,
    interests: undefined,
    behaviors: undefined,
  };

  console.log("\n4. Creating ad set: Leads campaign / 1% LAL audience / PAUSED for review…");
  const adset = await gpost<{ id: string }>(`/${ACCT}/adsets`, {
    name: "Restay — Leads — Lookalike 1% (US, IC seed)",
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
  console.log(`   adset_id=${adset.id}`);

  console.log("\n5. Creating ad in lookalike set with winning creative…");
  const ad = await gpost<{ id: string }>(`/${ACCT}/ads`, {
    name: "Restay — Lookalike — winner clone",
    adset_id: adset.id,
    creative: JSON.stringify({ creative_id: winner.creative.id }),
    status: "PAUSED",
  });
  console.log(`   ad_id=${ad.id}`);

  // ─── 6. Bump Leads campaign budget to make room ──────────────────────
  // Three CBO ad sets now (Interest stack + Retargeting + Lookalike). $75/day
  // → $120/day to give the new lookalike real impressions.
  console.log("\n6. Bumping Leads campaign $75 → $120/day to make room for the lookalike…");
  await gpost(`/${LEADS_CAMPAIGN_ID}`, { daily_budget: "12000" });

  console.log(`\n✓ Lookalike infrastructure built. PAUSED — review in Ads Manager, then activate.`);
  console.log(`   seed audience:    ${seed.id}`);
  console.log(`   lookalike 1%:     ${lal1.id}  (population builds in ~6h)`);
  console.log(`   ad set:           ${adset.id}`);
  console.log(`   ad:               ${ad.id}`);
  console.log(`   campaign budget:  $120/day across all 3 ad sets (CBO)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
