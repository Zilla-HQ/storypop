import { NextRequest, NextResponse } from "next/server";
import { extractSiteUrls } from "@/lib/extract-site-urls";

export const runtime = "nodejs";
export const maxDuration = 300;

const OUTREACH_SECRET = process.env.OUTREACH_SECRET;

/**
 * Discovery wrapper around /api/outreach. Give it directory / listing /
 * article URLs and it scrapes outbound links that look like company
 * websites, dedupes, then forwards the list to /api/outreach for the
 * find-email + audit + cold-email pipeline.
 *
 * Auth: same shared secret as /api/outreach (Authorization: Bearer).
 *
 * Body: { seedUrls: string[], dryRun?: boolean, maxPerSeed?: number }
 *
 * Response: { discovered: string[], outreach: <forwarded response> }
 */
export async function POST(req: NextRequest) {
  if (!OUTREACH_SECRET) {
    return NextResponse.json(
      { error: "OUTREACH_SECRET env var not set; discovery endpoint disabled" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  if (provided !== OUTREACH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { seedUrls?: unknown; dryRun?: unknown; maxPerSeed?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.seedUrls)) {
    return NextResponse.json({ error: "seedUrls must be an array of strings" }, { status: 400 });
  }
  const dryRun = Boolean(body.dryRun);
  const maxPerSeed =
    typeof body.maxPerSeed === "number" && body.maxPerSeed > 0 && body.maxPerSeed <= 100
      ? Math.floor(body.maxPerSeed)
      : 25;

  // Cap of 60 seeds/run lines up with the typical Vercel function runtime
  // budget (each seed page averages ~3-5s to fetch+parse + outbound MX
  // checks downstream). Bumped from 10 because the cold-outreach cron
  // routinely passes 40+ seed URLs after the first run dedupes them.
  const all = new Set<string>();
  for (const seed of body.seedUrls.slice(0, 60)) {
    if (typeof seed !== "string") continue;
    const found = await extractSiteUrls(seed, maxPerSeed);
    for (const u of found) all.add(u);
  }

  const discovered = Array.from(all);
  if (discovered.length === 0) {
    return NextResponse.json({ discovered: [], outreach: null, note: "no candidate URLs extracted" });
  }

  // Forward to /api/outreach (in-process — same secret).
  const origin = new URL(req.url).origin;
  const outreach = await fetch(`${origin}/api/outreach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OUTREACH_SECRET}`,
    },
    body: JSON.stringify({ urls: discovered, dryRun }),
  });
  const outreachJson = (await outreach.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json({ discovered, outreach: outreachJson });
}
