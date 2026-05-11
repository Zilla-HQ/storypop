/**
 * Create a website-traffic Custom Audience for retargeting + duplicate
 * the proven "Interest stack" ad set in the Leads campaign to target
 * that audience instead of the cold interest-stack audience.
 *
 * Audience definition:
 *   · INCLUDE: anyone who fired PageView in the last 30 days (warm visitor)
 *   · EXCLUDE: anyone who fired InitiateCheckout in the last 30 days
 *     (already deep in the funnel — let the lookalike/interest-stack
 *     handle them, not retargeting)
 *
 * This is the highest-leverage Meta move we have right now: warm
 * traffic costs ~3-5× less per conversion than cold, and we already
 * have ~58 LPVs from the Leads campaign + 167 LPVs from the Hosts
 * test = ~225 visitors who saw a Restay landing page and didn't buy.
 *
 *   npx tsx --env-file=.env.local scripts/meta-create-retargeting.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-create-retargeting.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PIXEL_ID = env("NEXT_PUBLIC_META_PIXEL_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

// Existing winning ad set we'll clone the targeting + creative from.
const SOURCE_ADSET_ID = "52544541002392"; // "Restay — Leads — Interest stack"
const LEADS_CAMPAIGN_ID = "52544540986192";

async function gpost(path: string, body: Record<string, string>): Promise<{ id: string }> {
  if (dryRun) {
    console.log(`[dry] POST ${path}`);
    for (const [k, v] of Object.entries(body)) {
      const display = v.length > 200 ? v.slice(0, 200) + "…" : v;
      console.log(`         ${k}: ${display}`);
    }
    return { id: "dry-run" };
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) params.set(k, v);
  const r = await fetch(url, { method: "POST", body: params, cache: "no-store" });
  const j = (await r.json()) as { id?: string; error?: { message: string } };
  if (!r.ok) throw new Error(`POST ${path} ${r.status}: ${JSON.stringify(j)}`);
  if (!j.id) throw new Error(`POST ${path}: no id in response: ${JSON.stringify(j)}`);
  return { id: j.id };
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Creating retargeting audience + ad set\n`);

  // ─── 1. Create the website-PageView Custom Audience ─────────────────
  // Meta Audience Rules format — pixel events with retention window
  // and an exclusion sub-rule for already-checking-out users.
  const audienceRule = {
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ id: PIXEL_ID, type: "pixel" }],
          retention_seconds: 30 * 24 * 60 * 60,
          filter: {
            operator: "and",
            filters: [
              { field: "event", operator: "eq", value: "PageView" },
            ],
          },
        },
      ],
    },
    exclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ id: PIXEL_ID, type: "pixel" }],
          retention_seconds: 30 * 24 * 60 * 60,
          filter: {
            operator: "and",
            filters: [
              { field: "event", operator: "eq", value: "InitiateCheckout" },
            ],
          },
        },
      ],
    },
  };

  console.log("1. Creating Custom Audience: warm visitors (30d, no checkout)…");
  // v22 deprecated `subtype` — Pixel-based audiences are inferred from
  // the presence of `pixel_id` + `rule` referencing pixel events.
  const audience = await gpost(`/${ACCT}/customaudiences`, {
    name: "Restay — Warm visitors (30d, no checkout)",
    description: "PageView in last 30d, excluding anyone who hit InitiateCheckout. Used for retargeting via the Leads campaign.",
    rule: JSON.stringify(audienceRule),
    retention_days: "30",
    pixel_id: PIXEL_ID,
  });
  console.log(`   audience_id=${audience.id}`);

  // ─── 2. Look up the source ad set so we can clone targeting + ad ────
  // Easier path: use Meta's /copies endpoint — it duplicates the ad
  // set + ads underneath it in one call. Then we patch targeting to
  // point at the new audience.
  console.log("\n2. Cloning the winning Interest-stack ad set…");
  const cloned = await gpost(`/${SOURCE_ADSET_ID}/copies`, {
    deep_copy: "true",
    status_option: "PAUSED",
    rename_options: JSON.stringify({ rename_strategy: "DEEP_RENAME", rename_suffix: " (retargeting)" }),
  });
  console.log(`   new_adset_id=${cloned.id}`);

  if (dryRun) {
    console.log("\n3. [skipped in dry-run] Patching cloned ad set targeting + activating…");
    console.log(`\nDone (dry-run). Run without --dry-run to apply.`);
    return;
  }

  // ─── 3. Patch the cloned ad set with the new audience targeting ────
  // We replace its `targeting` JSON to swap interest-based for the
  // retargeting custom audience. Daily budget bumped to $25 to give
  // it real reach.
  const newTargeting = {
    geo_locations: { countries: ["US"] },
    age_min: 28,
    age_max: 65,
    custom_audiences: [{ id: audience.id }],
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "video_feeds", "marketplace", "story"],
    instagram_positions: ["stream", "story", "explore", "reels"],
    device_platforms: ["mobile", "desktop"],
  };

  console.log("\n3. Patching cloned ad set: targeting=warm-audience, daily=$25, status=ACTIVE…");
  await gpost(`/${cloned.id}`, {
    targeting: JSON.stringify(newTargeting),
    daily_budget: "2500",
    status: "ACTIVE",
  });

  console.log(`\n✓ Retargeting ad set live`);
  console.log(`   campaign:    ${LEADS_CAMPAIGN_ID}`);
  console.log(`   ad set id:   ${cloned.id}`);
  console.log(`   audience id: ${audience.id}`);
  console.log(`   daily:       $25`);
  console.log(`\n   Combined daily ceiling now: ~$95/day across all campaigns.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
