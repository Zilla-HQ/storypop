/**
 * Add a single FLASH50-themed creative to the Interest-stack ad set.
 * One ad, ACTIVE, leverages 50% off + scarcity ("first 10 customers")
 * + 24h deadline.
 *
 * Doesn't disrupt existing 7 Interest-stack creatives — CBO will
 * allocate impressions based on CTR. If the discount angle resonates,
 * it'll absorb spend; if not, the proven creatives keep running.
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PAGE_ID = env("META_PAGE_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;

const APP_URL = "https://restay.agency";
const WINNING_VIDEO_ID = "25193588457006055";
const INTEREST_STACK_ADSET = "52544541002392";

async function gget<T>(path: string, fields = ""): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  if (fields) url.searchParams.set("fields", fields);
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`GET ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

async function gpost<T = { id: string }>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    params.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const r = await fetch(url, { method: "POST", body: params, cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`POST ${path} ${r.status}: ${JSON.stringify(j)}`);
  return j as T;
}

async function main() {
  const thumbResp = await gget<{ data?: Array<{ uri: string; is_preferred?: boolean }> }>(
    `/${WINNING_VIDEO_ID}/thumbnails`,
  );
  const preferred = thumbResp.data?.find((t) => t.is_preferred) ?? thumbResp.data?.[0];
  if (!preferred) throw new Error("no thumbnail");

  const destUrl = new URL(`${APP_URL}/`);
  destUrl.searchParams.set("promo", "FLASH50");
  destUrl.searchParams.set("utm_source", "meta");
  destUrl.searchParams.set("utm_medium", "paid_social");
  destUrl.searchParams.set("utm_campaign", "interest_stack");
  destUrl.searchParams.set("utm_content", "v4_flash50_24h");

  const objectStorySpec = {
    page_id: PAGE_ID,
    video_data: {
      video_id: WINNING_VIDEO_ID,
      title: "50% off Airbnb Tune-Up — 10 spots",
      message:
        "Launch week: 50% off the full Restay Tune-Up — rewritten copy + 10 restyled photos + 30-day pricing report. $39.50 instead of $79. First 10 customers, 24-hour deadline. Code FLASH50 auto-applies at checkout.",
      image_url: preferred.uri,
      call_to_action: { type: "GET_OFFER", value: { link: destUrl.toString() } },
    },
  };

  const creative = await gpost(`/${ACCT}/adcreatives`, {
    name: "Restay creative — v4_flash50_24h",
    object_story_spec: objectStorySpec,
  });
  console.log(`creative_id=${creative.id}`);

  const ad = await gpost(`/${ACCT}/ads`, {
    name: "Restay — v4_flash50_24h",
    adset_id: INTEREST_STACK_ADSET,
    creative: { creative_id: creative.id },
    status: "ACTIVE",
  });
  console.log(`ad_id=${ad.id}`);
  console.log("✓ FLASH50 ad live in Interest-stack ad set. CBO will allocate based on CTR.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
