import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 120;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const ACCESS_TOKEN = env("META_ADS_ACCESS_TOKEN");
const GRAPH = "https://graph.facebook.com/v19.0";

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

async function metaPost(pathname: string, body: Record<string, unknown>) {
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
    return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : text.slice(0, 400) };
  } catch {
    return { ok: false, status: res.status, error: text.slice(0, 400) };
  }
}

async function metaGet(pathname: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams({ ...query, access_token: ACCESS_TOKEN! });
  const res = await fetch(`${GRAPH}/${pathname}?${params}`);
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text), error: res.ok ? undefined : text.slice(0, 400) };
  } catch {
    return { ok: false, status: res.status, error: text.slice(0, 400) };
  }
}

/**
 * Flip a Meta campaign + all its ad sets + all its ads from PAUSED to ACTIVE.
 * Order matters: campaign first, then ad sets, then ads. Meta will sometimes
 * reject child activation if parent is paused.
 *
 *   POST /api/admin/meta-activate?campaign_id=120247340882150058
 *   Header: X-Trigger-Secret: <TRIGGER_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ACCESS_TOKEN) return NextResponse.json({ error: "META_ADS_ACCESS_TOKEN not set" }, { status: 400 });

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id");
  if (!campaignId) {
    return NextResponse.json({ error: "missing ?campaign_id" }, { status: 400 });
  }

  const log: { step: string; ok: boolean; id?: string; error?: string }[] = [];

  // 1. Activate campaign
  const camp = await metaPost(campaignId, { status: "ACTIVE" });
  log.push({ step: "campaign", ok: camp.ok, id: campaignId, error: camp.error });

  // 2. List ad sets in campaign + activate each
  const adsetList = await metaGet(`${campaignId}/adsets`, { fields: "id,name,status", limit: "100" });
  const adsetIds: string[] = [];
  if (adsetList.ok) {
    const data = (adsetList.data as { data?: { id: string; name: string }[] }).data ?? [];
    for (const a of data) {
      const r = await metaPost(a.id, { status: "ACTIVE" });
      log.push({ step: `adset ${a.name}`, ok: r.ok, id: a.id, error: r.error });
      if (r.ok) adsetIds.push(a.id);
    }
  } else {
    log.push({ step: "list adsets", ok: false, error: adsetList.error });
  }

  // 3. List ads in each ad set + activate each
  for (const adsetId of adsetIds) {
    const adList = await metaGet(`${adsetId}/ads`, { fields: "id,name,status", limit: "100" });
    if (adList.ok) {
      const data = (adList.data as { data?: { id: string; name: string }[] }).data ?? [];
      for (const ad of data) {
        const r = await metaPost(ad.id, { status: "ACTIVE" });
        log.push({ step: `ad ${ad.name}`, ok: r.ok, id: ad.id, error: r.error });
      }
    } else {
      log.push({ step: `list ads in ${adsetId}`, ok: false, error: adList.error });
    }
  }

  const allOk = log.every((l) => l.ok);
  return NextResponse.json({
    ok: allOk,
    campaign_id: campaignId,
    activations: log,
  });
}
