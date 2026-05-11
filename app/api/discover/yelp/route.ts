import { NextRequest, NextResponse } from "next/server";
import { searchYelpFanOut } from "@/lib/yelp";

export const runtime = "nodejs";
export const maxDuration = 300;

const OUTREACH_SECRET = process.env.OUTREACH_SECRET;

/**
 * Yelp-driven discovery. POST a list of business categories + cities
 * and we'll query Yelp Fusion, get back each business's *own* website
 * URL, then forward the list to /api/outreach for the find-email +
 * audit + cold-email pipeline.
 *
 * Auth: same OUTREACH_SECRET as /api/discover (Authorization: Bearer).
 *
 * Body: { terms: string[], locations: string[], dryRun?: boolean,
 *         perCallLimit?: number }
 *
 * Free tier: 5K Yelp calls/day. Each (term, location) is one call,
 * returning up to 50 businesses. So 4 terms × 12 cities = 48 calls per
 * run, getting up to 2,400 businesses.
 */
export async function POST(req: NextRequest) {
  if (!OUTREACH_SECRET) {
    return NextResponse.json({ error: "OUTREACH_SECRET not set" }, { status: 503 });
  }
  // The "Yelp" path actually goes through Apify's compass/yelp-scraper
  // Actor (see lib/yelp.ts) — Yelp Fusion's API doesn't expose each
  // business's own website URL, which is what outreach needs. So the
  // real credential we need is APIFY_TOKEN. The legacy YELP_API_KEY env
  // var is kept only as a backwards-compat fallback.
  if (!process.env.APIFY_TOKEN && !process.env.YELP_API_KEY) {
    return NextResponse.json(
      { error: "APIFY_TOKEN not set; Yelp discovery disabled" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth.replace(/^Bearer\s+/i, "") !== OUTREACH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { terms?: unknown; locations?: unknown; dryRun?: unknown; perCallLimit?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.terms) || !Array.isArray(body.locations)) {
    return NextResponse.json(
      { error: "terms and locations must be arrays of strings" },
      { status: 400 },
    );
  }
  const dryRun = Boolean(body.dryRun);
  const perCallLimit =
    typeof body.perCallLimit === "number" ? body.perCallLimit : 50;

  const terms = body.terms.filter((t): t is string => typeof t === "string").slice(0, 8);
  const locations = body.locations
    .filter((l): l is string => typeof l === "string")
    .slice(0, 25);

  const urls = await searchYelpFanOut({ terms, locations, perCallLimit });

  if (urls.length === 0) {
    return NextResponse.json({ discovered: 0, outreach: null, note: "no Yelp matches" });
  }

  if (dryRun) {
    return NextResponse.json({ discovered: urls.length, urls, dryRun: true });
  }

  // Forward to /api/outreach in-process (same secret).
  const origin = new URL(req.url).origin;
  const outreach = await fetch(`${origin}/api/outreach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OUTREACH_SECRET}`,
    },
    body: JSON.stringify({ urls }),
  });
  const outreachJson = (await outreach.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json({
    discovered: urls.length,
    outreach: outreachJson,
    outreachStatus: outreach.status,
  });
}
