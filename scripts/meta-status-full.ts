/**
 * Full status snapshot — campaigns, ad sets, and ads with effective_status.
 * Confirms what's actually running vs paused/disapproved/in-review.
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const BASE = `https://graph.facebook.com/v22.0`;

async function gget<T>(path: string, fields = ""): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  if (fields) url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "100");
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`GET ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

interface Campaign { id: string; name: string; status: string; effective_status: string; daily_budget?: string; objective: string }
interface AdSet { id: string; name: string; status: string; effective_status: string; daily_budget?: string; campaign_id: string }
interface Ad { id: string; name: string; status: string; effective_status: string; adset_id: string }

function statusIcon(s: string): string {
  if (s === "ACTIVE") return "✓";
  if (s === "PAUSED") return "⏸";
  if (s === "IN_PROCESS") return "⏳";
  if (s.includes("DISAPPROVED")) return "✗";
  if (s.includes("REVIEW")) return "⏳";
  if (s.includes("PENDING")) return "⏳";
  return "?";
}

async function main() {
  const camps = await gget<{ data: Campaign[] }>(
    `/${ACCT}/campaigns`,
    "id,name,status,effective_status,daily_budget,objective",
  );
  const adsets = await gget<{ data: AdSet[] }>(
    `/${ACCT}/adsets`,
    "id,name,status,effective_status,daily_budget,campaign_id",
  );
  const ads = await gget<{ data: Ad[] }>(
    `/${ACCT}/ads`,
    "id,name,status,effective_status,adset_id",
  );

  const adsetsByCamp = new Map<string, AdSet[]>();
  for (const a of adsets.data) {
    if (!adsetsByCamp.has(a.campaign_id)) adsetsByCamp.set(a.campaign_id, []);
    adsetsByCamp.get(a.campaign_id)!.push(a);
  }
  const adsByAdset = new Map<string, Ad[]>();
  for (const a of ads.data) {
    if (!adsByAdset.has(a.adset_id)) adsByAdset.set(a.adset_id, []);
    adsByAdset.get(a.adset_id)!.push(a);
  }

  let totalActiveAds = 0;
  let totalDailyBudgetCents = 0;

  for (const c of camps.data) {
    const cBudget = c.daily_budget ? Number(c.daily_budget) : 0;
    if (c.effective_status === "ACTIVE") totalDailyBudgetCents += cBudget;
    console.log(
      `\n${statusIcon(c.effective_status)} [${c.effective_status.padEnd(10)}] ${c.name}`,
    );
    console.log(
      `    id=${c.id}  obj=${c.objective}  daily=${cBudget ? `$${(cBudget / 100).toFixed(2)}` : "(ABO at adset)"}`,
    );

    const cAdsets = adsetsByCamp.get(c.id) ?? [];
    for (const a of cAdsets) {
      const aBudget = a.daily_budget ? Number(a.daily_budget) : 0;
      if (a.effective_status === "ACTIVE" && cBudget === 0) totalDailyBudgetCents += aBudget;
      console.log(
        `   ${statusIcon(a.effective_status)} [${a.effective_status.padEnd(10)}] ${a.name}`,
      );
      console.log(
        `        id=${a.id}  daily=${aBudget ? `$${(aBudget / 100).toFixed(2)}` : "(CBO)"}`,
      );

      const aAds = adsByAdset.get(a.id) ?? [];
      for (const ad of aAds) {
        if (ad.effective_status === "ACTIVE") totalActiveAds++;
        console.log(
          `       ${statusIcon(ad.effective_status)} [${ad.effective_status.padEnd(10)}] ${ad.name}  (${ad.id})`,
        );
      }
    }
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Total ACTIVE ads:     ${totalActiveAds}`);
  console.log(`Daily budget ceiling: $${(totalDailyBudgetCents / 100).toFixed(2)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
