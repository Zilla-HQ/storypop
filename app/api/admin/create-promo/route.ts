import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Create a Stripe coupon + promotion code at runtime so the production
 * STRIPE_SECRET_KEY can be used (Vercel marks it Sensitive, so we can't
 * pull it locally).
 *
 *   POST /api/admin/create-promo?code=LAUNCH50&pct=50&hours=24&max=200
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").toUpperCase();
  const pct = parseInt(url.searchParams.get("pct") ?? "0", 10);
  const hours = parseInt(url.searchParams.get("hours") ?? "24", 10);
  const max = parseInt(url.searchParams.get("max") ?? "200", 10);

  if (!code || !/^[A-Z0-9_-]{4,32}$/.test(code)) {
    return NextResponse.json(
      { error: "code must be 4-32 chars, A-Z 0-9 _ -" },
      { status: 400 },
    );
  }
  if (pct < 1 || pct > 95) {
    return NextResponse.json({ error: "pct must be 1-95" }, { status: 400 });
  }
  const expiresAt = Math.floor(Date.now() / 1000) + hours * 3600;

  // Check if already exists (idempotent).
  const existing = await stripe.promotionCodes.list({ code, limit: 1 });
  if (existing.data.length > 0) {
    return NextResponse.json({
      ok: true,
      existed: true,
      code,
      promotion_code_id: existing.data[0].id,
      coupon_id: existing.data[0].coupon.id,
      pct: existing.data[0].coupon.percent_off,
    });
  }

  const coupon = await stripe.coupons.create({
    name: `${code} (${pct}% off, ${hours}h)`,
    percent_off: pct,
    duration: "once",
    max_redemptions: max,
    redeem_by: expiresAt,
    metadata: { source: "create-promo-endpoint" },
  });

  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code,
    active: true,
    expires_at: expiresAt,
    max_redemptions: max,
  });

  return NextResponse.json({
    ok: true,
    created: true,
    code: promo.code,
    promotion_code_id: promo.id,
    coupon_id: coupon.id,
    pct,
    hours,
    max_redemptions: max,
    expires_at: new Date(expiresAt * 1000).toISOString(),
  });
}
