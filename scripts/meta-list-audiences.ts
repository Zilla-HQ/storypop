/**
 * List existing Custom Audiences on the ad account so we know what
 * retargeting pools are already wired up (vs. need to create).
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const BASE = `https://graph.facebook.com/v22.0`;

interface Audience {
  id: string;
  name: string;
  approximate_count?: number;
  subtype?: string;
  description?: string;
  delivery_status?: { code: number; description: string };
}

async function main() {
  const url = new URL(`${BASE}/${ACCT}/customaudiences`);
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("fields", "id,name,approximate_count,subtype,description,delivery_status");
  url.searchParams.set("limit", "50");
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json()) as { data?: Audience[]; error?: { message: string } };
  if (!r.ok || j.error) {
    console.error("Error:", j.error?.message ?? r.status);
    process.exit(1);
  }
  const audiences = j.data ?? [];
  console.log(`Custom audiences (${audiences.length}):\n`);
  for (const a of audiences) {
    console.log(`  · ${a.name}`);
    console.log(`      id=${a.id}  subtype=${a.subtype}  size≈${a.approximate_count ?? "?"}  status=${a.delivery_status?.description ?? "?"}`);
    if (a.description) console.log(`      ${a.description}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
