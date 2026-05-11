/**
 * Read-only Meta ads snapshot — campaigns, ad sets, ads, last-7d/30d insights.
 *
 * Run anytime to see what's actually happening in your account without going
 * to Ads Manager:
 *
 *   npx tsx scripts/meta-snapshot.ts
 *
 * Requires META_ADS_ACCESS_TOKEN + META_AD_ACCOUNT_ID. No writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const ACCOUNT_RAW = process.env.META_AD_ACCOUNT_ID!;
const V = process.env.META_API_VERSION || "v19.0";
const BASE = `https://graph.facebook.com/${V}`;

if (!TOKEN || !ACCOUNT_RAW) {
  console.error("Missing META_ADS_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  process.exit(1);
}
const accountId = ACCOUNT_RAW.startsWith("act_") ? ACCOUNT_RAW : `act_${ACCOUNT_RAW}`;

async function gget(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", TOKEN);
  const r = await fetch(u.toString());
  const j: any = await r.json();
  if (j.error) throw new Error(`${path}: ${j.error.message}`);
  return j;
}

const fmt = (n: any) => { const x = parseFloat(n ?? "0"); return Number.isFinite(x) ? x : 0; };

async function main() {
  const acctFields = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type";
  const [a7, a30] = await Promise.all([
    gget(`${accountId}/insights`, { fields: acctFields, date_preset: "last_7d" }),
    gget(`${accountId}/insights`, { fields: acctFields, date_preset: "last_30d" }),
  ]);

  console.log("=== ACCOUNT", accountId);
  for (const [label, j] of [["last_7d", a7], ["last_30d", a30]] as const) {
    const d = j.data?.[0];
    if (!d) { console.log(`${label}: no data`); continue; }
    const actions: Record<string, number> = {};
    for (const a of d.actions || []) actions[a.action_type] = fmt(a.value);
    console.log(`\n[${label}]`);
    console.log(`  spend     $${fmt(d.spend).toFixed(2)}`);
    console.log(`  impr      ${fmt(d.impressions)}`);
    console.log(`  clicks    ${fmt(d.clicks)}  CTR ${fmt(d.ctr).toFixed(2)}%  CPC $${fmt(d.cpc).toFixed(2)}  CPM $${fmt(d.cpm).toFixed(2)}`);
    console.log(`  reach     ${fmt(d.reach)}  freq ${fmt(d.frequency).toFixed(2)}`);
    const top = Object.entries(actions).sort((x, y) => y[1] - x[1]).slice(0, 8);
    if (top.length) {
      console.log(`  actions:`);
      for (const [k, v] of top) console.log(`    ${k.padEnd(40)} ${v}`);
    }
  }

  const campRes = await gget(`${accountId}/campaigns`, {
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,buying_type,bid_strategy,created_time",
    limit: "100",
  });
  const campaigns: any[] = campRes.data || [];

  console.log(`\n\n=== CAMPAIGNS (${campaigns.length})`);
  for (const c of campaigns) {
    console.log(`\n[${c.effective_status}] ${c.name}`);
    console.log(`  id ${c.id}  obj ${c.objective}  bid ${c.bid_strategy || "—"}`);
    if (c.daily_budget) console.log(`  daily_budget $${(parseInt(c.daily_budget) / 100).toFixed(2)}`);
    if (c.lifetime_budget) console.log(`  lifetime_budget $${(parseInt(c.lifetime_budget) / 100).toFixed(2)}`);

    try {
      const ci = await gget(`${c.id}/insights`, {
        fields: "spend,impressions,clicks,ctr,cpc,reach,frequency,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking",
        date_preset: "last_7d",
      });
      const d = ci.data?.[0];
      if (d) {
        const acts: Record<string, number> = {};
        for (const a of d.actions || []) acts[a.action_type] = fmt(a.value);
        console.log(`  7d: spend $${fmt(d.spend).toFixed(2)}  clicks ${fmt(d.clicks)}  CTR ${fmt(d.ctr).toFixed(2)}%  CPC $${fmt(d.cpc).toFixed(2)}  freq ${fmt(d.frequency).toFixed(2)}`);
        console.log(`      rankings: q=${d.quality_ranking || "—"}  eng=${d.engagement_rate_ranking || "—"}  conv=${d.conversion_rate_ranking || "—"}`);
        const conv = acts["offsite_conversion.fb_pixel_lead"] ?? acts["lead"] ?? acts["purchase"] ?? acts["offsite_conversion.fb_pixel_purchase"];
        if (conv != null) {
          const cac = fmt(d.spend) / conv;
          console.log(`      conv ${conv}  CAC $${cac.toFixed(2)}`);
        }
      } else {
        console.log(`  7d: no spend`);
      }
    } catch (e: any) {
      console.log(`  insights err: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  const [adsetRes, adRes] = await Promise.all([
    gget(`${accountId}/adsets`, { fields: "id,name,status,effective_status,campaign_id", limit: "200" }),
    gget(`${accountId}/ads`, { fields: "id,name,status,effective_status,adset_id", limit: "500" }),
  ]);
  console.log(`\n\n=== STRUCTURE`);
  console.log(`  campaigns: ${campaigns.length}`);
  console.log(`  ad sets:   ${(adsetRes.data || []).length}  (active: ${(adsetRes.data || []).filter((x: any) => x.effective_status === "ACTIVE").length})`);
  console.log(`  ads:       ${(adRes.data || []).length}  (active: ${(adRes.data || []).filter((x: any) => x.effective_status === "ACTIVE").length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
