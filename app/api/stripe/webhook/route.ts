import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db, orders } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { trackEvent } from "@/lib/posthog";
import { sendMetaEvent } from "@/lib/meta";

export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: "Signature verification failed", detail: String(err) },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) break;

      const [updated] = await db
        .update(orders)
        .set({
          status: "paid",
          stripePaymentIntentId: (session.payment_intent as string | null) ?? null,
          paidAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (updated) {
        await inngest.send({ name: "orders/paid", data: { orderId } });
        await trackEvent({
          distinctId: orderId,
          event: "order_paid",
          properties: {
            tier: updated.tier,
            amount_cents: updated.amountCents,
            listing_id: updated.listingId,
          },
        });
        // Server-side conversion event to Meta — critical for ad attribution
        // since iOS 14+ regularly drops the client-side Pixel Purchase event.
        // event_id matches what the Pixel would have sent so Meta dedupes.
        await sendMetaEvent({
          eventName: "Purchase",
          eventId: `order_${orderId}`,
          email: updated.customerEmail ?? undefined,
          value: updated.amountCents / 100,
          currency: "USD",
          customData: {
            content_ids: [updated.listingId],
            content_type: "product",
            order_id: orderId,
            tier: updated.tier,
          },
        });
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!pi) break;
      await db
        .update(orders)
        .set({ status: "refunded" })
        .where(eq(orders.stripePaymentIntentId, pi));
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
