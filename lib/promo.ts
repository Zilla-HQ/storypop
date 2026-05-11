/**
 * Promo code capture + resolution for Stripe Checkout discounts.
 *
 * Flow:
 *   1. middleware.ts captures `?promo=X` on any landing URL into a
 *      cookie (30-day TTL, mirrors the attribution cookie pattern)
 *   2. /api/checkout reads the cookie + resolves the human-readable
 *      code to a Stripe `promotion_code` ID, which gets added to the
 *      Checkout session's `discounts` array
 *   3. The customer hits Stripe Checkout with the discount already
 *      applied — no manual entry required
 *
 * Backstop: even if the cookie pipeline fails, the Checkout session
 * also sets `allow_promotion_codes: true`, so the customer can paste
 * the code manually at the Stripe page.
 */
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

const COOKIE_NAME = "restay_promo";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Capture `?promo=<code>` query param into a cookie. Called from
 * middleware on every public request. First-touch wins; existing
 * cookie isn't overwritten (so later URL visits don't steal a
 * partner's referral).
 *
 * Code is uppercased + length-capped + sanitized to alphanum/_- to
 * avoid header injection.
 */
export function capturePromoFromRequest(req: NextRequest, res: NextResponse): void {
  if (req.cookies.get(COOKIE_NAME)) return;
  const raw = req.nextUrl.searchParams.get("promo");
  if (!raw) return;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 60);
  if (!cleaned) return;
  res.cookies.set({
    name: COOKIE_NAME,
    value: cleaned,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}

/**
 * Read the captured promo code from the cookie (server-side).
 */
export async function readPromoCookie(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value;
  if (!v) return null;
  return v.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 60) || null;
}

/**
 * Resolve a human-readable promo code (e.g. `WELCOMEBACK2720`) to a
 * Stripe promotion_code resource ID (e.g. `promo_1TUG...`). Returns
 * null if the code doesn't exist, has expired, was redeemed, or is
 * inactive — so Checkout silently falls through to no-discount
 * instead of throwing.
 */
export async function resolveStripePromotionCode(code: string): Promise<string | null> {
  try {
    const list = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });
    const match = list.data[0];
    if (!match) return null;
    if (match.expires_at && match.expires_at * 1000 < Date.now()) return null;
    if (match.times_redeemed >= (match.max_redemptions ?? Infinity)) return null;
    return match.id;
  } catch {
    return null;
  }
}
