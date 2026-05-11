/**
 * Pull cost / CPC / conversions for a specific Meta ad.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-meta-ad-cost.ts <ad_id>
 *
 * Reports lifetime + last-7d insights for the ad, plus a CAC estimate.
 */
const AD_ID = process.argv[2];
if (!AD_ID) {
  console.error("Usage: scripts/inspect-meta-ad-cost.ts <ad_id>");
  process.exit(1);
}

const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const V = process.env.META_API_VERSION || "v19.0";
const BASE = `https://graph.facebook.com/${V}`;

if (!TOKEN) {
  console.error("Set META_ADS_ACCESS_TOKEN");
  process.exit(1);
}

interface Insights {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  date_start?: string;
  date_stop?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

async function fetchInsights(adId: string, range: string): Promise<Insights | null> {
  const fields = [
    "spend",
    "impressions",
    "clicks",
    "reach",
    "cpc",
    "cpm",
    "ctr",
    "frequency",
    "actions",
    "cost_per_action_type",
    "action_values",
    "date_start",
    "date_stop",
  ].join(",");
  const u = new URL(`${BASE}/${adId}/insights`);
  u.searchParams.set("fields", fields);
  u.searchParams.set("date_preset", range);
  u.searchParams.set("access_token", TOKEN);
  const r = await fetch(u.toString());
  const j: { data?: Insights[]; error?: { message: string } } = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.data?.[0] ?? null;
}

async function fetchAdInfo(adId: string): Promise<{ name?: string; campaign?: { name: string }; adset?: { name: string }; status?: string; effective_status?: string } | null> {
  const u = new URL(`${BASE}/${adId}`);
  u.searchParams.set("fields", "name,status,effective_status");
  u.searchParams.set("access_token", TOKEN);
  const r = await fetch(u.toString());
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

function findAction(insights: Insights, type: string): number {
  const a = insights.actions?.find((x) => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}
function findCostPer(insights: Insights, type: string): number | null {
  const a = insights.cost_per_action_type?.find((x) => x.action_type === type);
  return a ? parseFloat(a.value) : null;
}

function fmt(label: string, value: string | number) {
  console.log(`  ${label.padEnd(28)} ${value}`);
}

function block(title: string, ins: Insights | null) {
  console.log(`\n══════ ${title} ══════`);
  if (!ins) {
    console.log("  (no data)");
    return;
  }
  console.log(`  Range: ${ins.date_start} → ${ins.date_stop}`);
  fmt("Spend:", `$${parseFloat(ins.spend ?? "0").toFixed(2)}`);
  fmt("Impressions:", ins.impressions ?? "0");
  fmt("Reach (unique):", ins.reach ?? "0");
  fmt("Clicks:", ins.clicks ?? "0");
  fmt("CPC:", `$${parseFloat(ins.cpc ?? "0").toFixed(3)}`);
  fmt("CPM:", `$${parseFloat(ins.cpm ?? "0").toFixed(2)}`);
  fmt("CTR:", `${parseFloat(ins.ctr ?? "0").toFixed(2)}%`);
  fmt("Frequency:", parseFloat(ins.frequency ?? "0").toFixed(2));

  const purchases = findAction(ins, "purchase") || findAction(ins, "offsite_conversion.fb_pixel_purchase");
  const leads = findAction(ins, "lead") || findAction(ins, "offsite_conversion.fb_pixel_lead");
  const initiates = findAction(ins, "initiate_checkout") || findAction(ins, "offsite_conversion.fb_pixel_initiate_checkout");

  fmt("Purchases (attributed):", purchases.toFixed(0));
  fmt("Leads (attributed):", leads.toFixed(0));
  fmt("Checkouts started:", initiates.toFixed(0));

  const costPerPurchase =
    findCostPer(ins, "purchase") ?? findCostPer(ins, "offsite_conversion.fb_pixel_purchase");
  const costPerLead =
    findCostPer(ins, "lead") ?? findCostPer(ins, "offsite_conversion.fb_pixel_lead");
  if (costPerPurchase) fmt("Cost per purchase (CAC):", `$${costPerPurchase.toFixed(2)}`);
  if (costPerLead) fmt("Cost per lead:", `$${costPerLead.toFixed(2)}`);
}

async function main() {
  const info = await fetchAdInfo(AD_ID);
  if (info) {
    console.log(`AD ${AD_ID}`);
    console.log(`  Name:           ${info.name ?? "(unknown)"}`);
    console.log(`  Campaign:       ${info.campaign?.name ?? "(unknown)"}`);
    console.log(`  Ad set:         ${info.adset?.name ?? "(unknown)"}`);
    console.log(`  Status:         ${info.status} / ${info.effective_status}`);
  }

  const lifetime = await fetchInsights(AD_ID, "maximum");
  block("LIFETIME", lifetime);

  const last7d = await fetchInsights(AD_ID, "last_7d");
  block("LAST 7 DAYS", last7d);

  const last1d = await fetchInsights(AD_ID, "yesterday");
  block("YESTERDAY", last1d);

  const today = await fetchInsights(AD_ID, "today");
  block("TODAY", today);

  // Calculate effective CAC for the one customer we know about
  console.log("\n══════ ATTRIBUTION FOR THIS CUSTOMER ══════");
  if (lifetime) {
    const totalClicks = parseFloat(lifetime.clicks ?? "0");
    const totalSpend = parseFloat(lifetime.spend ?? "0");
    const totalPurchases =
      findAction(lifetime, "purchase") || findAction(lifetime, "offsite_conversion.fb_pixel_purchase");

    if (totalPurchases > 0) {
      console.log(`  Effective CAC across ${totalPurchases} purchase(s) on this ad:`);
      console.log(`    $${(totalSpend / totalPurchases).toFixed(2)} per customer (gross)`);
    } else if (totalClicks > 0) {
      console.log(`  No purchase event registered on this ad yet (Meta CAPI may lag).`);
      console.log(`  At lifetime CPC of $${(totalSpend / totalClicks).toFixed(3)}, this customer's click cost ≈ that.`);
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n✗", err);
  process.exit(1);
});

export {};
