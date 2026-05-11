import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const ACCESS_TOKEN = env("META_ADS_ACCESS_TOKEN");
const AD_ACCOUNT_ID = env("META_AD_ACCOUNT_ID");
const PIXEL_ID = env("NEXT_PUBLIC_META_PIXEL_ID");
const PAGE_ID = env("META_PAGE_ID");
const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
const GRAPH = "https://graph.facebook.com/v19.0";

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

async function metaPost(pathname: string, body: Record<string, unknown>): Promise<{
  ok: boolean; status: number; data?: Record<string, unknown>; error?: string;
}> {
  const url = `${GRAPH}/${pathname}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    params.append(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  params.append("access_token", ACCESS_TOKEN!);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 600) };
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: res.status, error: text.slice(0, 600) };
  }
}

/**
 * One-shot Meta retargeting setup. Creates:
 *   1. Custom Audience: people who triggered InitiateCheckout (last 30d)
 *      excluding those who triggered Purchase
 *   2. Custom Audience: people who triggered Lead (last 30d) excluding Purchase
 *   3. Ad creative (uses /public/ads/launch50-meta.jpg)
 *   4. Campaign (PAUSED until Jack reviews + activates) with OUTCOME_SALES
 *      objective optimizing for Purchase
 *   5. Two ad sets — one per audience — at $30/day each
 *   6. One ad per ad set referencing the creative
 *
 *   POST /api/admin/meta-setup
 *   Header: X-Trigger-Secret: <TRIGGER_SECRET>
 *   ?dry=1 — return what would be created without calling Meta
 *   ?budget=30 — daily budget per ad set in USD (default 30)
 *
 * Created in PAUSED status — Jack reviews in Ads Manager then activates.
 * Returns all IDs so the user can pick up where the API left off if any
 * step failed.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID || !PIXEL_ID || !PAGE_ID) {
    return NextResponse.json(
      {
        error: "Meta env not fully configured",
        missing: {
          access_token: !ACCESS_TOKEN,
          ad_account_id: !AD_ACCOUNT_ID,
          pixel_id: !PIXEL_ID,
          page_id: !PAGE_ID,
        },
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const dailyBudgetCents = parseInt(url.searchParams.get("budget") ?? "30", 10) * 100;
  // mode=retarget (default) requires Custom Audiences (and Meta TOS
  // acceptance). mode=cold uses interest-based targeting only — no
  // Custom Audiences needed, runs immediately without manual TOS step.
  const mode = (url.searchParams.get("mode") ?? "retarget").toLowerCase();

  if (dry) {
    return NextResponse.json({
      dry: true,
      ad_account: AD_ACCOUNT_ID,
      pixel_id: PIXEL_ID,
      page_id: PAGE_ID,
      daily_budget_per_adset_cents: dailyBudgetCents,
      will_create: [
        "Custom Audience: RS - InitiateCheckout 30d (no purchase)",
        "Custom Audience: RS - Lead 30d (no purchase)",
        "Ad image upload",
        "Ad creative",
        "Campaign (PAUSED, OUTCOME_SALES)",
        "Ad set 1: retarget InitiateCheckout audience",
        "Ad set 2: retarget Lead audience",
        "1 ad per ad set",
      ],
    });
  }

  // Append a short timestamp to every created entity so retries produce
  // fresh entities (Meta rejects duplicate audience names).
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(2, 12); // yymmddhhmm
  const result: Record<string, unknown> = {};
  const errors: string[] = [];

  // ─── 1. Custom Audiences — only in retarget mode ─────────────────────
  // Skip entirely in cold mode (interest targeting doesn't need them).
  if (mode === "cold") {
    // Skip audience creation; ad sets later use interest targeting.
  }

  const buildRule = (eventName: string) => ({
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: PIXEL_ID, type: "pixel" }],
        retention_seconds: 30 * 24 * 60 * 60,
        filter: {
          operator: "and",
          filters: [{ field: "event", operator: "eq", value: eventName }],
        },
      }],
    },
    exclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: PIXEL_ID, type: "pixel" }],
        retention_seconds: 30 * 24 * 60 * 60,
        filter: {
          operator: "and",
          filters: [{ field: "event", operator: "eq", value: "Purchase" }],
        },
      }],
    },
  });

  const audIC = mode === "cold" ? { ok: false, status: 0, data: undefined as unknown } : await metaPost(`act_${AD_ACCOUNT_ID}/customaudiences`, {
    name: `RS - InitiateCheckout 30d (no purchase) ${stamp}`,
    pixel_id: PIXEL_ID!,
    rule: buildRule("InitiateCheckout"),
    retention_days: 30,
    description: "People who clicked a tier on /l/<slug> but didn't pay (last 30d)",
  });
  if (audIC.ok && audIC.data && (audIC.data as { id?: string }).id) {
    result.audience_initiatecheckout = (audIC.data as { id: string }).id;
  } else if (mode !== "cold") {
    errors.push(`audience InitiateCheckout: ${(audIC as { error?: string }).error ?? "skipped"}`);
  }

  const audLead = mode === "cold" ? { ok: false, status: 0, data: undefined as unknown } : await metaPost(`act_${AD_ACCOUNT_ID}/customaudiences`, {
    name: `RS - Lead 30d (no purchase) ${stamp}`,
    pixel_id: PIXEL_ID!,
    rule: buildRule("Lead"),
    retention_days: 30,
    description: "People who submitted a URL on /agents (last 30d, no purchase)",
  });
  if (audLead.ok && audLead.data && (audLead.data as { id?: string }).id) {
    result.audience_lead = (audLead.data as { id: string }).id;
  } else if (mode !== "cold") {
    errors.push(`audience Lead: ${(audLead as { error?: string }).error ?? "skipped"}`);
  }

  // ─── 2. Upload ad image ─────────────────────────────────────────────
  let imageHash: string | undefined;
  try {
    const imgPath = path.join(process.cwd(), "public", "ads", "launch50-meta.jpg");
    const imgBuf = readFileSync(imgPath);
    const fd = new FormData();
    fd.append("access_token", ACCESS_TOKEN!);
    fd.append("source", new Blob([new Uint8Array(imgBuf)], { type: "image/jpeg" }), "launch50-meta.jpg");
    const upRes = await fetch(`${GRAPH}/act_${AD_ACCOUNT_ID}/adimages`, {
      method: "POST",
      body: fd,
    });
    const upJson = await upRes.json();
    if (upRes.ok && upJson?.images) {
      const firstKey = Object.keys(upJson.images)[0];
      imageHash = upJson.images[firstKey]?.hash;
      result.image_hash = imageHash;
    } else {
      errors.push(`adimage upload: ${JSON.stringify(upJson).slice(0, 400)}`);
    }
  } catch (e) {
    errors.push(`adimage upload exception: ${(e as Error).message}`);
  }

  // ─── 3. Ad creative ─────────────────────────────────────────────────
  let creativeId: string | undefined;
  if (imageHash) {
    const creativeRes = await metaPost(`act_${AD_ACCOUNT_ID}/adcreatives`, {
      name: `RS Launch50 Retarget v1 ${stamp}`,
      object_story_spec: {
        page_id: PAGE_ID!,
        link_data: {
          message:
            "Stage every interior photo on your listing in <2 hours. $89 per listing, NAR-compliant. 50% off today with code LAUNCH50.",
          link: `${APP_URL}/agents?code=LAUNCH50&utm_source=meta&utm_campaign=retarget`,
          name: "Virtual staging in 2 hours — $89 per listing",
          description:
            "Paste any Zillow URL. Free preview, NAR-compliant, 14-day refund. 50% off launch promo.",
          caption: "realscale.app",
          image_hash: imageHash,
          call_to_action: { type: "GET_OFFER", value: { link: `${APP_URL}/agents?code=LAUNCH50` } },
        },
      },
    });
    if (creativeRes.ok && creativeRes.data?.id) {
      creativeId = creativeRes.data.id as string;
      result.creative_id = creativeId;
    } else {
      errors.push(`adcreative: ${creativeRes.error}`);
    }
  }

  // ─── 4. Campaign (PAUSED) ───────────────────────────────────────────
  let campaignId: string | undefined;
  const campRes = await metaPost(`act_${AD_ACCOUNT_ID}/campaigns`, {
    name: mode === "cold" ? `Realscale - Cold Targeting (LAUNCH50) ${stamp}` : `Realscale - Retargeting (LAUNCH50) ${stamp}`,
    objective: "OUTCOME_SALES",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
    is_adset_budget_sharing_enabled: false,
  });
  if (campRes.ok && campRes.data?.id) {
    campaignId = campRes.data.id as string;
    result.campaign_id = campaignId;
  } else {
    errors.push(`campaign: ${campRes.error}`);
  }

  // ─── 5. Ad sets ─────────────────────────────────────────────────────
  const adSetIds: { name: string; id: string; ad_id?: string }[] = [];
  if (campaignId) {
    type AdSetSpec = { name: string; targeting: Record<string, unknown> };
    const adSetSpecs: AdSetSpec[] = mode === "cold"
      ? await (async () => {
          // Try to dynamically resolve interest IDs via Meta's targeting
          // search API. Falls back to broad targeting if the search fails
          // (account-specific permission issues are common).
          const resolveInterest = async (q: string): Promise<{ id: string; name: string } | null> => {
            try {
              const sParams = new URLSearchParams({
                type: "adinterest",
                q,
                limit: "1",
                access_token: ACCESS_TOKEN!,
              });
              const r = await fetch(`${GRAPH}/search?${sParams}`);
              const j = await r.json() as { data?: { id?: string; name?: string }[] };
              const hit = j.data?.[0];
              if (hit?.id && hit?.name) return { id: hit.id, name: hit.name };
              return null;
            } catch {
              return null;
            }
          };
          const [realEstate, realtor] = await Promise.all([
            resolveInterest("Real estate"),
            resolveInterest("Realtor.com"),
          ]);
          const interests = [realEstate, realtor].filter((x): x is { id: string; name: string } => x !== null);

          const out: AdSetSpec[] = [];
          if (interests.length > 0) {
            out.push({
              name: "Cold - Real estate interests",
              targeting: {
                geo_locations: { countries: ["US"] },
                age_min: 25,
                age_max: 65,
                interests,
                publisher_platforms: ["facebook", "instagram"],
                facebook_positions: ["feed"],
                instagram_positions: ["stream", "reels"],
              },
            });
          }
          // Always run a broad-US ad set — Meta's Purchase-event optimization
          // finds the right audience without explicit interest filters.
          out.push({
            name: "Cold - Broad US 25-65",
            targeting: {
              geo_locations: { countries: ["US"] },
              age_min: 25,
              age_max: 65,
              publisher_platforms: ["facebook", "instagram"],
              facebook_positions: ["feed"],
              instagram_positions: ["stream", "reels"],
            },
          });
          return out;
        })()
      : [
          { name: "Retarget InitiateCheckout 30d", targeting: { custom_audiences: [{ id: result.audience_initiatecheckout as string }] } },
          { name: "Retarget Lead 30d", targeting: { custom_audiences: [{ id: result.audience_lead as string }] } },
        ].filter((s) => mode === "cold" || (s.targeting.custom_audiences as { id?: string }[])?.[0]?.id);

    for (const spec of adSetSpecs) {
      const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now
      // Merge spec targeting with shared defaults (geo, age, placements)
      // for retarget specs that only set custom_audiences.
      const targeting =
        mode === "cold"
          ? spec.targeting
          : {
              ...spec.targeting,
              geo_locations: { countries: ["US"] },
              age_min: 25,
              age_max: 65,
              publisher_platforms: ["facebook", "instagram"],
              facebook_positions: ["feed"],
              instagram_positions: ["stream", "reels"],
            };
      const adSetRes = await metaPost(`act_${AD_ACCOUNT_ID}/adsets`, {
        name: `Realscale - ${spec.name} ${stamp}`,
        campaign_id: campaignId,
        billing_event: "IMPRESSIONS",
        optimization_goal: "OFFSITE_CONVERSIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        daily_budget: dailyBudgetCents,
        promoted_object: { pixel_id: PIXEL_ID!, custom_event_type: "PURCHASE" },
        targeting,
        status: "PAUSED",
        start_time: startTime,
      });
      if (adSetRes.ok && adSetRes.data?.id) {
        const adSetId = adSetRes.data.id as string;
        adSetIds.push({ name: spec.name, id: adSetId });

        // 6. Ad referencing creative
        if (creativeId) {
          const adRes = await metaPost(`act_${AD_ACCOUNT_ID}/ads`, {
            name: `Realscale - ${spec.name} - Ad v1 ${stamp}`,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status: "PAUSED",
          });
          if (adRes.ok && adRes.data?.id) {
            adSetIds[adSetIds.length - 1].ad_id = adRes.data.id as string;
          } else {
            errors.push(`ad ${spec.name}: ${adRes.error}`);
          }
        }
      } else {
        errors.push(`adset ${spec.name}: ${adSetRes.error}`);
      }
    }
    result.adsets = adSetIds;
  }

  return NextResponse.json({
    ok: errors.length === 0,
    result,
    errors,
    next_steps: campaignId
      ? `Open https://business.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT_ID}&selected_campaign_ids=${campaignId} — campaign and ad sets are PAUSED. Audiences need ~30-60min to populate. After that, switch the campaign to ACTIVE.`
      : "Setup failed — see errors. Audiences may have been created; check Meta Ads Manager.",
  });
}
