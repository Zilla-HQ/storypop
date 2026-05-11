/**
 * Round 2 of creative variants. Round 1 (v2_*) added problem/price/
 * velocity angles. Round 2 adds social-proof, curiosity, and
 * competitor-comparison angles. Same video, new copy. Round 3+ if
 * v2 round shows a clear winner.
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PAGE_ID = env("META_PAGE_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

const APP_URL = "https://restay.agency";
const WINNING_VIDEO_ID = "25193588457006055";
const INTEREST_STACK_ADSET = "52544541002392";

interface Variant {
  slug: string;
  primary: string;
  headline: string;
  cta: "LEARN_MORE" | "GET_OFFER";
  landingPath: "/" | "/grade";
}

const VARIANTS: Variant[] = [
  {
    slug: "v3_social_proof",
    primary:
      "Built by an Airbnb host for Airbnb hosts. The free grader has been run on 2,200+ listings in the last 30 days. Paste your URL — see where you sit.",
    headline: "Free Airbnb Grader",
    cta: "LEARN_MORE",
    landingPath: "/grade",
  },
  {
    slug: "v3_curiosity_gap",
    primary:
      "Most Airbnb listings have 3 fixable mistakes that quietly suppress bookings. Free 10-second grader names yours specifically — copy weakness, photo issues, signal gaps. No signup.",
    headline: "What's Wrong With Your Listing?",
    cta: "LEARN_MORE",
    landingPath: "/grade",
  },
  {
    slug: "v3_subscription_kill",
    primary:
      "Subscription listing tools cost $30-200/month. We optimize yours once for $79 — rewritten copy, 10 restyled photos, 30-day pricing report. Delivered in 4 hours.",
    headline: "$79 vs $360/yr",
    cta: "GET_OFFER",
    landingPath: "/",
  },
];

async function getThumbnailUrl(videoId: string): Promise<string> {
  const url = new URL(`${BASE}/${videoId}/thumbnails`);
  url.searchParams.set("access_token", TOKEN);
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json()) as { data?: Array<{ uri: string; is_preferred?: boolean }> };
  const preferred = j.data?.find((t) => t.is_preferred) ?? j.data?.[0];
  if (!preferred) throw new Error(`No thumbnails for video ${videoId}`);
  return preferred.uri;
}

async function gpost<T = { id: string }>(path: string, body: Record<string, unknown>): Promise<T> {
  if (dryRun) {
    console.log(`[dry] POST ${path}`);
    return { id: "dry-run" } as T;
  }
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

function utmUrl(v: Variant): string {
  const u = new URL(`${APP_URL}${v.landingPath}`);
  u.searchParams.set("utm_source", "meta");
  u.searchParams.set("utm_medium", "paid_social");
  u.searchParams.set("utm_campaign", "interest_stack");
  u.searchParams.set("utm_content", v.slug);
  return u.toString();
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Adding ${VARIANTS.length} round-2 creative variants\n`);
  const thumb = dryRun ? "<dry>" : await getThumbnailUrl(WINNING_VIDEO_ID);

  for (const v of VARIANTS) {
    console.log(`→ ${v.slug}`);
    const objectStorySpec = {
      page_id: PAGE_ID,
      video_data: {
        video_id: WINNING_VIDEO_ID,
        title: v.headline,
        message: v.primary,
        image_url: thumb,
        call_to_action: { type: v.cta, value: { link: utmUrl(v) } },
      },
    };
    const creative = await gpost(`/${ACCT}/adcreatives`, {
      name: `Restay creative — ${v.slug}`,
      object_story_spec: objectStorySpec,
    });
    console.log(`   creative_id=${creative.id}`);
    const ad = await gpost(`/${ACCT}/ads`, {
      name: `Restay — ${v.slug}`,
      adset_id: INTEREST_STACK_ADSET,
      creative: { creative_id: creative.id },
      status: "ACTIVE",
    });
    console.log(`   ad_id=${ad.id}\n`);
  }

  console.log(`✓ ${VARIANTS.length} round-2 variants ACTIVE. Interest-stack now has 7 ads competing under CBO.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
