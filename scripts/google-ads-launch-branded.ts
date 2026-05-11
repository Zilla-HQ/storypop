/**
 * Programmatic launch of a merchant's Google Ads branded-defense campaign.
 *
 *   set -a && source .env.local && set +a && \
 *     npx tsx scripts/google-ads-launch-branded.ts
 *
 * Creates the entire campaign in a single atomic googleAds:mutate call —
 * campaign budget, search campaign, ad group, exact + phrase keywords,
 * negative keywords, location targeting (US), language (English), and
 * one Responsive Search Ad with 15 headlines + 4 descriptions + display
 * path. Resource IDs are temp-allocated negatives that get resolved into
 * real IDs server-side.
 *
 * The campaign is created **PAUSED** so you can spot-check it in the Ads
 * UI before unpausing. Same shape the GOOGLE_ADS_OPERATOR.md walkthrough
 * produces by hand — this is the API equivalent.
 *
 * Sitelinks + callouts are NOT created here (they need separate Asset +
 * CampaignAsset operations). Comment block at the bottom shows the v20
 * Asset shape for when extending.
 *
 * Per-merchant customization: edit the constants in §1 below. Everything
 * below the divider is generic and reusable.
 *
 * Pre-reqs:
 *   1. Zilla HQ MCC + Basic API access (see GOOGLE_ADS.md §2)
 *   2. Per-merchant ad account inside MCC + 6 env vars (see §3)
 *   3. Smoke test passes: npx tsx scripts/google-ads-smoke-test.ts
 */

const ENV = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v.trim();
};

const DEVELOPER_TOKEN = ENV("GOOGLE_ADS_DEVELOPER_TOKEN");
const CLIENT_ID = ENV("GOOGLE_ADS_CLIENT_ID");
const CLIENT_SECRET = ENV("GOOGLE_ADS_CLIENT_SECRET");
const REFRESH_TOKEN = ENV("GOOGLE_ADS_REFRESH_TOKEN");
const CUSTOMER_ID = ENV("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
const LOGIN_CUSTOMER_ID = ENV("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, "");
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v20";

// ─── §1. Per-merchant constants ─────────────────────────────────────────────
// EDIT THIS BLOCK to launch a branded-defense campaign for any merchant.
// Everything below the divider is generic plumbing.

const BRAND = "Restay";                            // Display name in campaign / ad group
const DOMAIN = "restay.agency";                    // Public marketing domain
const FINAL_URL = `https://${DOMAIN}`;             // Where ad clicks land
const DAILY_BUDGET_MICROS = 2_000_000;             // $2/day — $60/mo cap
const MAX_CPC_MICROS = 1_500_000;                  // $1.50 ceiling per click
const CAMPAIGN_NAME = `${BRAND} - Branded Defense v1`;
const AD_GROUP_NAME = `${BRAND} - Brand Keywords`;
const BUDGET_NAME = `${CAMPAIGN_NAME} - Budget`;
const UTM_CAMPAIGN_TAG = "branded_v1";             // Final URL suffix utm_campaign

// Brand-name variants. Wrap with [...] in the API as match_type=EXACT.
const KEYWORDS_EXACT = [
  "restay",
  "restay agency",
  "restay airbnb",
  "restay listing",
  "restay tune up",
];
// Phrase-match variants. Use bare strings; match_type=PHRASE is set programmatically.
const KEYWORDS_PHRASE = ["restay.agency"];

// Block these — every branded campaign should add these as negatives.
const NEGATIVE_KEYWORDS = ["free", "job", "jobs", "download", "app", "reviews", "login"];

// 15 headlines, 30-char ceiling each. Pin "Official Site" to position 1
// so the brand always shows on the first line.
const HEADLINES: { text: string; pinPosition?: 1 | 2 | 3 }[] = [
  { text: `${BRAND} Official Site`, pinPosition: 1 },
  { text: `${BRAND} - <Product>` },
  { text: "Free <Vertical> Audit" },
  { text: "Free Listing Grader" },
  { text: "Rewrite, Restyle, Reprice" },
  { text: "Less Than a Month of <Competitor>" },
  { text: "$<Price> <Product>" },
  { text: "Edit-Only Photos. TOS Safe." },
  { text: "4-Hour Listing Optimization" },
  { text: "Stop Losing Bookings" },
  { text: "Grade Your Listing Free" },
  { text: "10-Second Listing Audit" },
  { text: "No Subscription. One Time." },
  { text: "Get The 3 Highest-Impact Fixes" },
  { text: "Refund Within 14 Days" },
];

// 4 descriptions, 90-char ceiling each.
const DESCRIPTIONS = [
  "Paste your URL. Get an instant audit, restyled photo, pricing scan. Free.",
  "One-time $<price>: <deliverables>. No sub.",
  "<Compliance line>. Originals retained. <refund line>.",
  "Less than a month of <competitor>. Delivered in <SLA>. <market>.",
];

const PATH1 = "grade";  // Visible URL path slug 1 (15 chars max)
const PATH2 = "free";   // Visible URL path slug 2 (15 chars max)

// US country geo target. Numeric IDs at https://developers.google.com/google-ads/api/data/geotargets
const GEO_US = "geoTargetConstants/2840";
// English language constant.
const LANG_EN = "languageConstants/1000";

// ─── §2. Generic plumbing — no per-merchant edits below ─────────────────────

async function mintAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  const j = (await r.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(`Token mint failed: ${j.error_description}`);
  return j.access_token;
}

async function gads<T>(args: {
  accessToken: string;
  path: string;
  body: Record<string, unknown>;
}): Promise<T> {
  const r = await fetch(`https://googleads.googleapis.com/${API_VERSION}${args.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
      "login-customer-id": LOGIN_CUSTOMER_ID,
      "content-type": "application/json",
    },
    body: JSON.stringify(args.body),
  });
  const text = await r.text();
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${r.status} non-JSON: ${text.slice(0, 600)}`);
  }
  if (!r.ok || j.error) {
    throw new Error(`HTTP ${r.status}: ${j.error?.message || JSON.stringify(j).slice(0, 600)}`);
  }
  return j as T;
}

const tempBudget = `customers/${CUSTOMER_ID}/campaignBudgets/-1`;
const tempCampaign = `customers/${CUSTOMER_ID}/campaigns/-2`;
const tempAdGroup = `customers/${CUSTOMER_ID}/adGroups/-3`;

function buildOperations() {
  const ops: Record<string, unknown>[] = [];

  // 1. Budget
  ops.push({
    campaignBudgetOperation: {
      create: {
        resourceName: tempBudget,
        name: BUDGET_NAME,
        amountMicros: String(DAILY_BUDGET_MICROS),
        deliveryMethod: "STANDARD",
        explicitlyShared: false,
      },
    },
  });

  // 2. Campaign (PAUSED — operator unpauses after spot-check)
  ops.push({
    campaignOperation: {
      create: {
        resourceName: tempCampaign,
        name: CAMPAIGN_NAME,
        status: "PAUSED",
        advertisingChannelType: "SEARCH",
        campaignBudget: tempBudget,
        manualCpc: { enhancedCpcEnabled: false },
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: false,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
        },
        geoTargetTypeSetting: {
          positiveGeoTargetType: "PRESENCE_OR_INTEREST",
          negativeGeoTargetType: "PRESENCE_OR_INTEREST",
        },
        finalUrlSuffix: `utm_source=google&utm_medium=cpc&utm_campaign=${UTM_CAMPAIGN_TAG}`,
      },
    },
  });

  // 3. Geo target (US)
  ops.push({
    campaignCriterionOperation: {
      create: { campaign: tempCampaign, location: { geoTargetConstant: GEO_US } },
    },
  });

  // 4. Language (English)
  ops.push({
    campaignCriterionOperation: {
      create: { campaign: tempCampaign, language: { languageConstant: LANG_EN } },
    },
  });

  // 5. Ad group
  ops.push({
    adGroupOperation: {
      create: {
        resourceName: tempAdGroup,
        name: AD_GROUP_NAME,
        campaign: tempCampaign,
        status: "ENABLED",
        type: "SEARCH_STANDARD",
        cpcBidMicros: String(MAX_CPC_MICROS),
      },
    },
  });

  // 6. Exact-match keywords
  for (const kw of KEYWORDS_EXACT) {
    ops.push({
      adGroupCriterionOperation: {
        create: {
          adGroup: tempAdGroup,
          status: "ENABLED",
          keyword: { text: kw, matchType: "EXACT" },
        },
      },
    });
  }

  // 7. Phrase-match keywords
  for (const kw of KEYWORDS_PHRASE) {
    ops.push({
      adGroupCriterionOperation: {
        create: {
          adGroup: tempAdGroup,
          status: "ENABLED",
          keyword: { text: kw, matchType: "PHRASE" },
        },
      },
    });
  }

  // 8. Negative keywords (broad-match negatives at ad-group scope)
  for (const kw of NEGATIVE_KEYWORDS) {
    ops.push({
      adGroupCriterionOperation: {
        create: {
          adGroup: tempAdGroup,
          negative: true,
          keyword: { text: kw, matchType: "BROAD" },
        },
      },
    });
  }

  // 9. Responsive Search Ad
  const headlines = HEADLINES.map((h) => ({
    text: h.text,
    ...(h.pinPosition ? { pinnedField: `HEADLINE_${h.pinPosition}` } : {}),
  }));
  ops.push({
    adGroupAdOperation: {
      create: {
        adGroup: tempAdGroup,
        status: "ENABLED",
        ad: {
          finalUrls: [FINAL_URL],
          responsiveSearchAd: {
            headlines,
            descriptions: DESCRIPTIONS.map((d) => ({ text: d })),
            path1: PATH1,
            path2: PATH2,
          },
        },
      },
    },
  });

  return ops;
}

async function main() {
  console.log(`Launching branded-defense campaign for ${BRAND} (${CUSTOMER_ID})\n`);

  console.log("1. Minting access token...");
  const accessToken = await mintAccessToken();

  const operations = buildOperations();
  console.log(`2. Built ${operations.length} mutate operations:`);
  console.log(`     • 1 campaign budget`);
  console.log(`     • 1 campaign (PAUSED)`);
  console.log(`     • 2 campaign criteria (US geo, English)`);
  console.log(`     • 1 ad group`);
  console.log(`     • ${KEYWORDS_EXACT.length} exact-match keywords`);
  console.log(`     • ${KEYWORDS_PHRASE.length} phrase-match keywords`);
  console.log(`     • ${NEGATIVE_KEYWORDS.length} negative keywords`);
  console.log(`     • 1 responsive search ad`);

  console.log("3. Submitting atomic mutate to googleAds:mutate...");
  const result = await gads<{
    mutateOperationResponses?: Array<{
      campaignBudgetResult?: { resourceName: string };
      campaignResult?: { resourceName: string };
      adGroupResult?: { resourceName: string };
      adGroupAdResult?: { resourceName: string };
      adGroupCriterionResult?: { resourceName: string };
      campaignCriterionResult?: { resourceName: string };
    }>;
  }>({
    accessToken,
    path: `/customers/${CUSTOMER_ID}/googleAds:mutate`,
    body: {
      mutateOperations: operations,
      // partial_failure: true would let some ops fail without aborting all
      // of them. We deliberately leave it false so the campaign launch is
      // atomic — partial state is worse than no state.
    },
  });

  console.log("✓ Mutate succeeded\n");

  const responses = result.mutateOperationResponses || [];
  const budgetResp = responses[0]?.campaignBudgetResult?.resourceName;
  const campaignResp = responses[1]?.campaignResult?.resourceName;
  const adGroupResp = responses[4]?.adGroupResult?.resourceName;

  console.log("Resources created:");
  console.log(`  Budget:    ${budgetResp}`);
  console.log(`  Campaign:  ${campaignResp}`);
  console.log(`  Ad group:  ${adGroupResp}`);

  console.log("\n────────────────────────────────────────");
  console.log("✓ Branded campaign created in PAUSED state.");
  console.log("\nNext steps:");
  console.log(`  1. Open https://ads.google.com → switch to ad account ${CUSTOMER_ID}`);
  console.log(`  2. Find "${CAMPAIGN_NAME}" → spot-check headlines + ad preview`);
  console.log(`  3. Add sitelinks + callouts via UI (5 minutes — Assets → +)`);
  console.log(`  4. Add conversion action with destination URL pattern matching '/delivery/'`);
  console.log(`  5. Click ENABLE on the campaign`);
  console.log(`  6. Save the campaign ID to env:`);
  if (campaignResp) {
    const campaignId = campaignResp.split("/").pop();
    console.log(`     GOOGLE_ADS_BRANDED_CAMPAIGN_ID=${campaignId}`);
    console.log(`     GOOGLE_ADS_BRANDED_LAUNCH_DATE=${new Date().toISOString().slice(0, 10)}`);
  }
  console.log("────────────────────────────────────────");
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`);
  process.exit(1);
});

// ─── §3. Future: extending with sitelinks + callouts ────────────────────────
//
// Sitelinks and callouts are Assets in v20. To add them in the same mutate:
//
// const tempSitelink1 = `customers/${CUSTOMER_ID}/assets/-100`;
// ops.push({
//   assetOperation: {
//     create: {
//       resourceName: tempSitelink1,
//       sitelinkAsset: {
//         linkText: "Free Listing Grader",
//         description1: "Score your listing 0-100",
//         description2: "10 seconds, no signup",
//       },
//       finalUrls: [`${FINAL_URL}/grade`],
//     },
//   },
// });
// ops.push({
//   campaignAssetOperation: {
//     create: {
//       campaign: tempCampaign,
//       asset: tempSitelink1,
//       fieldType: "SITELINK",
//     },
//   },
// });
//
// Same shape for callouts with `calloutAsset: { calloutText: "..." }` and
// `fieldType: "CALLOUT"`.

export {};
