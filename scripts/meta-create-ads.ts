/**
 * Create N copy variants × M ad sets = N×M video ads, all PAUSED, referencing
 * a previously-uploaded video. Customize VARIANTS to match your hooks.
 *
 *   npx tsx scripts/meta-create-ads.ts
 *
 * Pre-reqs:
 *   - VIDEO_ID set below — output of scripts/meta-upload-page-video.ts
 *   - META_LEAD_CAMPAIGN_ID + ad set IDs from scripts/meta-launch-campaign.ts
 *
 * The pre-set Meta thumbnail (is_preferred:true) is fetched automatically and
 * passed as image_url in video_data. AdCreative requires this — without it the
 * API returns "Please specify one of image_hash or image_url".
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const ACCOUNT_RAW = process.env.META_AD_ACCOUNT_ID!;
const PAGE_ID = process.env.META_PAGE_ID!;
const V = process.env.META_API_VERSION || "v19.0";

const ACCOUNT = ACCOUNT_RAW.startsWith("act_") ? ACCOUNT_RAW : `act_${ACCOUNT_RAW}`;
const BASE = `https://graph.facebook.com/${V}`;

// --- Customize per launch ---
const VIDEO_ID = process.env.META_VIDEO_ID || "REPLACE_ME"; // from meta-upload-page-video.ts
const CAMPAIGN_ID = process.env.META_LEAD_CAMPAIGN_ID!;
const ADSET_A_ID = process.env.META_LEAD_ADSET_A_ID!;
const ADSET_B_ID = process.env.META_LEAD_ADSET_B_ID!;
const LANDING = process.env.NEXT_PUBLIC_BASE_URL || "https://example.com/";
const UTM_CAMPAIGN = "v1_lead";

const VARIANTS = [
  // Edit these to match your merchant — these are the SiteGrid examples for
  // reference. Each variant tests a different angle: speed/magic vs.
  // anti-subscription vs. problem-aware vs. social-proof.
  {
    slug: "v1_speed",
    primary: "Type your business name. Watch a real website build itself in 30 seconds. $199 once. No subscription, ever.",
    headline: "Your website, built in 30 seconds",
    description: "$199 once · No subscription",
    cta: "LEARN_MORE",
  },
  {
    slug: "v2_anti_sub",
    primary: "Stop paying $300 a year for a website. Pay $199 once for one we actually built using your real photos and Google reviews.",
    headline: "Cancel Wix. Pay once.",
    description: "$199 once · Year-one hosting",
    cta: "SIGN_UP",
  },
  {
    slug: "v3_problem",
    primary: "No website = your customers are finding your competitors. We'll build you a real one in 30 seconds. $199 once.",
    headline: "Your customers can't find you",
    description: "30 seconds · $199 once",
    cta: "GET_OFFER",
  },
  {
    slug: "v4_proof",
    primary: "Restaurants. Dentists. Salons. Gyms. We build websites in 30 seconds using your real Google data. $199 once. Type your business to see yours.",
    headline: "Your business deserves a real website",
    description: "30 seconds · $199 once",
    cta: "LEARN_MORE",
  },
];
// ---

if (!TOKEN || !ACCOUNT_RAW || !PAGE_ID || !CAMPAIGN_ID || !ADSET_A_ID || !ADSET_B_ID || VIDEO_ID === "REPLACE_ME") {
  console.error("Missing required env: META_ADS_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID, META_LEAD_CAMPAIGN_ID, META_LEAD_ADSET_A_ID, META_LEAD_ADSET_B_ID, META_VIDEO_ID");
  process.exit(1);
}

function utmLink(slug: string, set: "A" | "B"): string {
  const u = new URL(LANDING);
  u.searchParams.set("utm_source", "meta");
  u.searchParams.set("utm_medium", "paid_social");
  u.searchParams.set("utm_campaign", UTM_CAMPAIGN);
  u.searchParams.set("utm_content", `${slug}_set${set}`);
  return u.toString();
}

async function post(path: string, body: any) {
  const r = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const j: any = await r.json();
  if (j.error) throw new Error(`${path}: ${j.error.message}\n  ${j.error.error_user_msg || ""}`);
  return j;
}

async function getThumbUrl(videoId: string): Promise<string> {
  // Fetch via page token (the System User token won't read videos that belong
  // to the page unless we use the page-scoped token).
  const pgRes = await fetch(`${BASE}/${PAGE_ID}?fields=access_token&access_token=${TOKEN}`);
  const pgJson: any = await pgRes.json();
  const pageTok = pgJson.access_token || TOKEN;
  const r = await fetch(`${BASE}/${videoId}/thumbnails?access_token=${pageTok}`);
  const j: any = await r.json();
  const preferred = (j.data || []).find((t: any) => t.is_preferred) || j.data?.[0];
  if (!preferred) throw new Error("no thumbnail returned for video");
  return preferred.uri;
}

async function main() {
  console.log("Fetching video thumbnail...");
  const thumbUrl = await getThumbUrl(VIDEO_ID);
  console.log("  ✓ thumbnail ready\n");

  let created = 0;
  for (const variant of VARIANTS) {
    for (const [label, adsetId] of [["A", ADSET_A_ID], ["B", ADSET_B_ID]] as const) {
      const link = utmLink(variant.slug, label);
      process.stdout.write(`→ ${variant.slug} → set${label}  `);

      const creative = await post(`${ACCOUNT}/adcreatives`, {
        name: `creative — ${variant.slug} — set${label}`,
        object_story_spec: {
          page_id: PAGE_ID,
          video_data: {
            video_id: VIDEO_ID,
            image_url: thumbUrl,
            title: variant.headline,
            message: variant.primary,
            link_description: variant.description,
            call_to_action: { type: variant.cta, value: { link } },
          },
        },
      });

      const ad = await post(`${ACCOUNT}/ads`, {
        name: `ad — ${variant.slug} — set${label}`,
        adset_id: adsetId,
        creative: { creative_id: creative.id },
        status: "PAUSED",
      });

      console.log(`creative ${creative.id} → ad ${ad.id}`);
      created++;
    }
  }

  console.log(`\n${created} ads created (PAUSED)`);
  console.log(`https://business.facebook.com/adsmanager/manage/ads?act=${ACCOUNT_RAW}&selected_campaign_ids=${CAMPAIGN_ID}`);
  console.log(`\nNext: spot-check each ad's preview → unpause campaign → ad sets → ads (in that order).`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
