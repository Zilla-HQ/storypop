import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const list = await stripe.promotionCodes.list({ code: "FLASH50", limit: 1 });
    const promo = list.data[0];
    if (!promo || !promo.active) {
      return NextResponse.json({ active: false, spotsLeft: 0, expiresAt: null });
    }
    const expiresAt = promo.expires_at ? promo.expires_at * 1000 : null;
    if (expiresAt && expiresAt < Date.now()) {
      return NextResponse.json({ active: false, spotsLeft: 0, expiresAt });
    }
    const max = promo.max_redemptions ?? 10;
    const spotsLeft = Math.max(0, max - promo.times_redeemed);
    return NextResponse.json({
      active: spotsLeft > 0,
      spotsLeft,
      expiresAt,
      percentOff: promo.coupon.percent_off ?? null,
      code: "FLASH50",
    });
  } catch {
    return NextResponse.json({ active: false, spotsLeft: 0, expiresAt: null });
  }
}
