/**
 * Drill into ad sets + ads under each campaign so we can see which
 * ones are actually performing and pick scaling moves.
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const BASE = `https://graph.facebook.com/v22.0`;

async function gget(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`GET ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

interface AdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  optimization_goal?: string;
  campaign_id: string;
  insights?: { data?: Array<{ spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string; actions?: Array<{ action_type: string; value: string }> }> };
}

async function main() {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "daily_budget",
    "optimization_goal",
    "campaign_id",
    "insights.date_preset(maximum){spend,impressions,clicks,ctr,cpc,actions}",
  ].join(",");
  const r = (await gget(`/${ACCT}/adsets`, { fields, limit: "50" })) as { data: AdSet[] };
  const sets = r.data ?? [];
  console.log(`Ad sets (${sets.length}):\n`);
  for (const s of sets) {
    const ins = s.insights?.data?.[0];
    const spend = Number(ins?.spend ?? 0);
    const lpv = Number(ins?.actions?.find((a) => a.action_type === "landing_page_view")?.value ?? 0);
    const leads = Number(ins?.actions?.find((a) => a.action_type === "lead")?.value ?? 0);
    const cplpv = lpv > 0 ? `$${(spend / lpv).toFixed(2)}` : "—";
    const dailyBudget = s.daily_budget ? `$${(Number(s.daily_budget) / 100).toFixed(2)}/day` : "(no daily budget)";
    console.log(`  · [${s.effective_status.padEnd(8)}] ${s.name}`);
    console.log(`      id=${s.id}  campaign=${s.campaign_id}`);
    console.log(`      goal=${s.optimization_goal}  budget=${dailyBudget}`);
    console.log(`      spend=$${spend.toFixed(2)}  imp=${ins?.impressions ?? 0}  clicks=${ins?.clicks ?? 0}  CTR=${ins?.ctr ?? 0}%  CPC=$${ins?.cpc ?? 0}  LPV=${lpv}  CPLPV=${cplpv}  Leads=${leads}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
