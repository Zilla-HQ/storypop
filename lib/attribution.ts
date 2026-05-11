import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Acquisition attribution — capture UTM params + referrer on the visitor's
 * first session, persist for 30 days, hand off into self-serve listing
 * inserts so paid orders attribute back to the ad channel.
 *
 * MERCHANT TEMPLATE NOTE: This module is intentionally generic and merchant-
 * agnostic. Reusable across forks without modification.
 */

const COOKIE_NAME = "restay_attr"; // safe to rename per-merchant; opaque value
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
type TrackedParam = (typeof TRACKED_PARAMS)[number];

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
}

/**
 * Used by middleware.ts on every request — if the request URL contains any
 * utm_* params and no attribution cookie exists yet, set the cookie. Sticky
 * for 30 days; first-touch wins.
 */
export function captureAttributionFromRequest(req: NextRequest, res: NextResponse): void {
  if (req.cookies.get(COOKIE_NAME)) return; // first-touch already captured

  const url = req.nextUrl;
  const data: Attribution = {};
  let any = false;
  for (const p of TRACKED_PARAMS) {
    const v = url.searchParams.get(p);
    if (v) {
      data[p] = v.slice(0, 200);
      any = true;
    }
  }
  const referrer = req.headers.get("referer");
  if (referrer && !referrer.includes(req.nextUrl.host)) {
    data.referrer = referrer.slice(0, 500);
    any = true;
  }
  if (!any) return;

  res.cookies.set({
    name: COOKIE_NAME,
    value: encodeURIComponent(JSON.stringify(data)),
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // readable from client too if we ever want to surface it
  });
}

/**
 * Read attribution cookie from a server-side route (e.g. /api/self-serve).
 * Returns empty object if no cookie set.
 */
export async function readAttribution(): Promise<Attribution> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw)) as Attribution;
  } catch {
    return {};
  }
}
