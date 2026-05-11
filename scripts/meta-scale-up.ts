/**
 * Aggressive scaling pass on Meta ads. Decisions encoded here, not
 * passed in flags, so the operator log is the audit trail:
 *
 *   1. PAUSE the losing ad set — "Advantage+ broad" was 3× worse on
 *      CPLPV than the "Interest stack" sibling. Stops bleeding spend
 *      against a known loser.
 *   2. BUMP the Leads campaign daily budget to $50/day (was implicit
 *      via CBO; we set explicit so we know what we're spending). This
 *      is the William-conversion campaign — proven funnel, just needs
 *      more impressions.
 *   3. BUMP "Hosts audit test" ad set from $4/day → $20/day. CTR 5.3%,
 *      CPLPV $0.12 — cheapest traffic in the account by 13×.
 *
 * Read --dry-run first; live writes happen on real run.
 *
 *   npx tsx --env-file=.env.local scripts/meta-scale-up.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-scale-up.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

async function gpost(path: string, body: Record<string, string>): Promise<unknown> {
  if (dryRun) {
    console.log(`[dry] POST ${path} ← ${JSON.stringify(body)}`);
    return { id: "dry-run" };
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) params.set(k, v);
  const r = await fetch(url, { method: "POST", body: params, cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`POST ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Scaling Meta campaigns\n`);

  // ─── 1. Pause "Advantage+ broad" — 3× worse CPLPV than interest stack ──
  const advantagePlusAdsetId = "52544540990392";
  console.log("1. Pausing Advantage+ broad (CPLPV $4.93 vs interest stack $1.57)…");
  await gpost(`/${advantagePlusAdsetId}`, { status: "PAUSED" });

  // ─── 2. Bump Leads campaign budget — set explicit daily $50/day ────────
  const leadsCampaignId = "52544540986192";
  console.log("2. Bumping Leads campaign daily budget → $50/day…");
  // Switch CBO to an explicit daily budget at campaign level (5000 cents = $50)
  await gpost(`/${leadsCampaignId}`, { daily_budget: "5000" });

  // ─── 3. Bump Hosts audit test ad set $4/day → $20/day ──────────────────
  const hostsTestAdsetId = "52540911304592";
  console.log("3. Bumping Hosts audit test ad set $4 → $20/day…");
  await gpost(`/${hostsTestAdsetId}`, { daily_budget: "2000" });

  console.log(`\n${dryRun ? "Dry run complete." : "Live changes applied."}`);
  console.log(`Combined daily spend ceiling: ~$70/day (was ~$30/day).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
