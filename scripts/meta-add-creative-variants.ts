/**
 * Add 3 new copy variants of the winning creative (video_id
 * 25193588457006055, CTR 8.95%) to the proven Interest-stack ad set.
 * Same visual, different angle text → CBO will A/B and reweight
 * automatically.
 *
 * Why this is the highest-leverage Meta move right now: we have one
 * proven creative and zero alternatives. Meta optimizes by testing.
 * No alternatives = no test = stuck at the current CTR. 3 angles
 * (problem-led / price-led / velocity-led) gives the algorithm
 * something to work with at zero new visual-asset cost.
 *
 *   npx tsx --env-file=.env.local scripts/meta-add-creative-variants.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/meta-add-creative-variants.ts
 */
import { env } from "@/lib/env";

const TOKEN = env("META_ADS_ACCESS_TOKEN") ?? env("META_CAPI_ACCESS_TOKEN")!;
const ACCT_RAW = env("META_AD_ACCOUNT_ID")!;
const ACCT = ACCT_RAW.startsWith("act_") ? ACCT_RAW : `act_${ACCT_RAW}`;
const PAGE_ID = env("META_PAGE_ID")!;
const BASE = `https://graph.facebook.com/v22.0`;
const dryRun = process.argv.includes("--dry-run");

// Hardcode the public production URL — env reads NEXT_PUBLIC_APP_URL from
// .env.local which is set to localhost for dev. Meta rejects non-public URIs.
const APP_URL = "https://restay.agency";

// Reuse the winning creative's video. Same visual, new copy.
const WINNING_VIDEO_ID = "25193588457006055";
const INTEREST_STACK_ADSET = "52544541002392";

async function getThumbnailUrl(videoId: string): Promise<string> {
  const url = new URL(`${BASE}/${videoId}/thumbnails`);
  url.searchParams.set("access_token", TOKEN);
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json()) as { data?: Array<{ uri: string; is_preferred?: boolean }> };
  const preferred = j.data?.find((t) => t.is_preferred) ?? j.data?.[0];
  if (!preferred) throw new Error(`No thumbnails for video ${videoId}`);
  return preferred.uri;
}

interface Variant {
  slug: string;
  primary: string;
  headline: string;
  description: string;
  cta: "LEARN_MORE" | "GET_OFFER" | "SIGN_UP";
  landingPath: "/" | "/grade";
}

const VARIANTS: Variant[] = [
  {
    slug: "v2_problem_grader",
    primary:
      "Most Airbnb listings are quietly losing bookings to better-optimized comps next door. Paste your URL — get a 0-100 grade in 10 seconds. Free, no signup.",
    headline: "Free Airbnb Listing Grader",
    description: "Photos, copy, signals scored 0-100. The 3 fixes that lift bookings most.",
    cta: "LEARN_MORE",
    landingPath: "/grade",
  },
  {
    slug: "v2_price_refund",
    primary:
      "$79 one-time. Rewritten copy + 10 restyled photos + 30-day pricing report. Delivered in under 4 hours. Full refund within 14 days if it doesn't lift bookings.",
    headline: "$79 Airbnb Listing Tune-Up",
    description: "One-time fee. No subscription. 14-day full-refund window.",
    cta: "GET_OFFER",
    landingPath: "/",
  },
  {
    slug: "v2_velocity_deadline",
    primary:
      "If you haven't refreshed your listing in 12 months, you're losing 15-25% of bookable nights to comps that did. We rebuild yours in 4 hours.",
    headline: "Listing Refresh — 4-Hour Turnaround",
    description: "Rewrite, restyle, reprice. Delivered tonight. $79 one-time.",
    cta: "GET_OFFER",
    landingPath: "/",
  },
];

async function gpost<T = { id: string }>(path: string, body: Record<string, unknown>): Promise<T> {
  if (dryRun) {
    console.log(`[dry] POST ${path}`);
    for (const [k, v] of Object.entries(body)) {
      const display = typeof v === "string" ? v : JSON.stringify(v);
      console.log(`         ${k}: ${display.length > 220 ? display.slice(0, 220) + "…" : display}`);
    }
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
  if (!r.ok) {
    console.error(`   FAILED. body sent:`);
    for (const [k, v] of Object.entries(body)) {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      console.error(`     ${k}: ${s}`);
    }
    throw new Error(`POST ${path} ${r.status}: ${JSON.stringify(j)}`);
  }
  return j as T;
}

function utmUrl(variant: Variant): string {
  const u = new URL(`${APP_URL}${variant.landingPath}`);
  u.searchParams.set("utm_source", "meta");
  u.searchParams.set("utm_medium", "paid_social");
  u.searchParams.set("utm_campaign", "interest_stack");
  u.searchParams.set("utm_content", variant.slug);
  return u.toString();
}

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Adding ${VARIANTS.length} new ads to Interest-stack ad set\n`);

  // Resolve thumbnail once — same video for all variants.
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
        call_to_action: {
          type: v.cta,
          value: { link: utmUrl(v) },
        },
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
      status: "ACTIVE", // ACTIVE so CBO starts A/B testing immediately
    });
    console.log(`   ad_id=${ad.id}\n`);
  }

  console.log(`${dryRun ? "Dry run complete." : `✓ ${VARIANTS.length} new ads ACTIVE in Interest-stack ad set.`}`);
  console.log(`  Meta will auto-allocate impressions across all 4 creatives (1 winner + 3 new) and reweight by CTR.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
