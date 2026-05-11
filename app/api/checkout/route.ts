import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, orders, listings } from "@/db";
import { eq } from "drizzle-orm";
import { stripe, publicAppUrl } from "@/lib/stripe";
import { getSettings } from "@/db/settings";

export const runtime = "nodejs";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  listingSlug: z.string().optional(),
  tier: z.enum(["standard", "premium", "rush"]),
  stylePreset: z.string(),
  /** Optional Stripe promotion_code id (e.g. "FOUNDING10"). Looked up at checkout. */
  promoCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid body", detail: String(err) }, { status: 400 });
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, body.listingId))
    .limit(1);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const settings = await getSettings();
  const amountCents =
    body.tier === "standard"
      ? settings.pricingStandardCents
      : body.tier === "premium"
        ? settings.pricingPremiumCents
        : settings.pricingRushCents;

  // Affiliate attribution — first-touch cookie set by middleware when a
  // visitor arrives with ?ref=CODE. Stamp on the order at checkout time
  // so the admin/referrals view can compute payouts directly from orders.
  const referralCode = req.cookies.get("rs_ref")?.value ?? null;

  const [order] = await db
    .insert(orders)
    .values({
      listingId: listing.id,
      tier: body.tier,
      stylePreset: body.stylePreset,
      amountCents,
      status: "pending",
      customerEmail: listing.agentEmail ?? null,
      referralCode,
    })
    .returning();

  const appUrl = publicAppUrl();

  // Look up promo code if provided. Stripe's promotion_codes API takes a "code"
  // (the customer-facing string like "FOUNDING10"); we pass back the id.
  let discountId: string | null = null;
  if (body.promoCode) {
    try {
      const promos = await stripe.promotionCodes.list({
        code: body.promoCode,
        active: true,
        limit: 1,
      });
      if (promos.data.length > 0) {
        discountId = promos.data[0].id;
      }
    } catch {
      // Silent fail — we'd rather charge full price than 500.
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: listing.agentEmail ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Realscale — ${body.tier} enhancement`,
            description: `Enhanced photos for ${listing.address}. Style: ${body.stylePreset}.`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    ...(discountId
      ? { discounts: [{ promotion_code: discountId }] }
      : { allow_promotion_codes: true }),
    metadata: {
      orderId: order.id,
      listingId: listing.id,
      tier: body.tier,
      stylePreset: body.stylePreset,
      ...(body.promoCode ? { promoCode: body.promoCode } : {}),
      ...(referralCode ? { referralCode } : {}),
    },
    success_url: `${appUrl}/delivery/${order.id}?paid=1`,
    cancel_url: body.listingSlug
      ? `${appUrl}/l/${body.listingSlug}`
      : `${appUrl}/checkout/${order.id}`,
  });

  await db
    .update(orders)
    .set({ stripeSessionId: session.id })
    .where(eq(orders.id, order.id));

  return NextResponse.json({ orderId: order.id, url: session.url });
}
