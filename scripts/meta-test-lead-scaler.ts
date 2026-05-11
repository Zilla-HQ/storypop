/**
 * Smoke test for the lead-scaler logic — calls Meta API but does NOT update
 * campaigns (read-only). Run before deploying scaler config changes to verify
 * the math + API access.
 *
 *   npx tsx scripts/meta-test-lead-scaler.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const CAMPAIGN_ID = process.env.META_LEAD_CAMPAIGN_ID!;
const LAUNCH_DATE = process.env.META_LEAD_LAUNCH_DATE!;
const INITIAL = Number(process.env.META_LEAD_INITIAL_BUDGET_CENTS || "7500");
const MAX = Number(process.env.META_LEAD_MAX_BUDGET_CENTS || "20000");
const CAC_EARLY = Number(process.env.META_LEAD_CAC_CEILING_EARLY || "7");
const CAC_STEADY = Number(process.env.META_LEAD_CAC_CEILING_STEADY || "5");
const MIN_SPEND = Number(process.env.META_LEAD_MIN_SPEND || "50");
const V = process.env.META_API_VERSION || "v19.0";

if (!TOKEN || !CAMPAIGN_ID || !LAUNCH_DATE) {
  console.error("Need META_ADS_ACCESS_TOKEN, META_LEAD_CAMPAIGN_ID, META_LEAD_LAUNCH_DATE in env");
  process.exit(1);
}

function targetBudget(daysSinceLaunch: number): number {
  const bumps = Math.max(0, Math.floor(daysSinceLaunch / 3));
  return Math.min(MAX, Math.round(INITIAL * Math.pow(1.2, bumps)));
}

function leadCount(actions: any[]): number {
  if (!actions) return 0;
  for (const a of actions) if (a.action_type === "offsite_conversion.fb_pixel_lead") return Number(a.value) || 0;
  for (const a of actions) if (a.action_type === "lead") return Number(a.value) || 0;
  return 0;
}

const launch = new Date(LAUNCH_DATE + "T00:00:00Z").getTime();
const days = Math.floor((Date.now() - launch) / 86400000);
const ceiling = days >= 14 ? CAC_STEADY : CAC_EARLY;
const target = targetBudget(days);

console.log(`days since launch: ${days}`);
console.log(`CAC ceiling:       $${ceiling}`);
console.log(`target budget:     $${target / 100}/day`);

console.log("\nfetching Meta insights...");
const fields = "spend,impressions,clicks,actions,date_start,date_stop";
const url = `https://graph.facebook.com/${V}/${CAMPAIGN_ID}/insights?fields=${fields}&date_preset=last_7d&access_token=${TOKEN}`;
const r = await fetch(url);
const j: any = await r.json();
if (j.error) {
  console.error("ERROR:", j.error.message);
  process.exit(1);
}
const ins = j.data?.[0];
const spend = parseFloat(ins?.spend || "0");
const leads = leadCount(ins?.actions);
const cac = leads > 0 ? spend / leads : null;
console.log(`spend last 7d:  $${spend.toFixed(2)}`);
console.log(`leads last 7d:  ${leads}`);
console.log(`CAC:            ${cac == null ? "—" : `$${cac.toFixed(2)}`}`);

console.log("\nDECISION:");
if (spend >= MIN_SPEND && cac != null && cac > ceiling) {
  console.log(`  → would PAUSE (CAC $${cac.toFixed(2)} > ceiling $${ceiling})`);
} else if (cac != null && cac > ceiling) {
  console.log(`  → would HOLD: CAC $${cac.toFixed(2)} > ceiling but spend $${spend.toFixed(2)} < min $${MIN_SPEND}`);
} else {
  console.log(`  → would SET budget to $${target / 100}/day`);
}
console.log("\n[read-only smoke test — no Meta updates were sent]");
