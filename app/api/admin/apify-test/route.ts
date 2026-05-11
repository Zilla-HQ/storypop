import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Ops-only debug endpoint to test Apify actors with arbitrary inputs without
 * needing local APIFY_TOKEN access. Returns the count + the first few items
 * so the operator can iterate on the search-input format until the actor
 * actually returns volume.
 *
 * Auth via X-Trigger-Secret header. Restricts which actors can be invoked
 * to MLS / property-data sources only — no general-purpose Apify shell.
 */
const ALLOWED_ACTOR_PREFIXES = [
  "maxcopell/",
  "tugkan/",
  "epctex/",
  "apify/google-search-scraper",
  "compass/",
];

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "APIFY_TOKEN not set" }, { status: 500 });
  }

  let body: { actor?: string; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const actor = body.actor;
  if (!actor || !ALLOWED_ACTOR_PREFIXES.some((p) => actor.startsWith(p))) {
    return NextResponse.json(
      { error: "actor must be in allowlist", allowed: ALLOWED_ACTOR_PREFIXES },
      { status: 400 },
    );
  }

  const id = actor.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${id}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.input ?? {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Apify ${res.status}`, body: text.slice(0, 500) },
        { status: 502 },
      );
    }
    const items = (await res.json()) as unknown[];
    return NextResponse.json({
      ok: true,
      actor,
      count: items.length,
      sample: items.slice(0, 3),
      keys: items[0] && typeof items[0] === "object" ? Object.keys(items[0] as object) : [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
