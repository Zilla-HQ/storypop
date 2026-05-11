/**
 * Resolve a human-readable promo string (e.g. "FOUNDING10") to a Stripe
 * promotion-code ID (e.g. "promo_xxx") for pre-application at checkout.
 *
 * The Stripe Checkout `discounts` array takes promo IDs, not human strings.
 * Without this lookup, customers have to manually type the code into the
 * "Add promotion code" Stripe field — friction worth ~5-10% conversion lift
 * to remove.
 *
 * Caches found IDs in-process for the request lifetime — Stripe rate-limits
 * promo lookups and the same code is often reused across many checkouts.
 *
 * Also exposes a cookie-based capture flow (capturePromoFromRequest +
 * readPromoCookie) so URL-based promos like recovery-email links
 * (`/?promo=WELCOMEBACK2720`) auto-apply at checkout without the customer
 * having to retype the code. See META_ADS.md §5b for the recovery flow.
 */
import { stripe } from "@/lib/stripe";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, string | null>();

export async function resolvePromotionCode(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const list = await stripe.promotionCodes.list({ code: key, active: true, limit: 1 });
    const id = list.data[0]?.id ?? null;
    cache.set(key, id);
    if (!id) console.warn(`[stripe-promo] no active promotion code for "${key}"`);
    return id;
  } catch (err: any) {
    console.warn(`[stripe-promo] lookup failed for "${key}":`, err?.message);
    return null;
  }
}

// ─── Cookie-based promo capture (URL → cookie → checkout) ────────────

const PROMO_COOKIE_NAME = "merchant_promo";
const PROMO_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Capture `?promo=<code>` query param into a cookie. Called from
 * middleware on every public request. First-touch wins; existing
 * cookie isn't overwritten.
 *
 * Code is uppercased + length-capped + sanitized to alphanum/_- to
 * avoid header injection.
 */
export function capturePromoFromRequest(req: NextRequest, res: NextResponse): void {
  if (req.cookies.get(PROMO_COOKIE_NAME)) return;
  const raw = req.nextUrl.searchParams.get("promo");
  if (!raw) return;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 60);
  if (!cleaned) return;
  res.cookies.set({
    name: PROMO_COOKIE_NAME,
    value: cleaned,
    maxAge: PROMO_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}

/**
 * Read the captured promo code from the cookie. Server-only. Returns
 * null if no cookie set.
 */
export async function readPromoCookie(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(PROMO_COOKIE_NAME)?.value;
  if (!v) return null;
  return v.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 60) || null;
}
