import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db, orders } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { trackEvent } from "@/lib/posthog";
import { sendCapiEvent } from "@/lib/meta-capi";

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
      // Stripe metadata keys: /api/checkout sets `order_id` (snake_case).
      // Reading `orderId` (camelCase) — as this file did before — silently
      // dropped EVERY webhook. Accept both during the migration so any
      // historical sessions still resolve.
      const orderId = (session.metadata?.order_id
        ?? session.metadata?.orderId
        ?? session.client_reference_id) as string | undefined;
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
        await sendCapiEvent({
          eventName: "Purchase",
          eventId: `order_${orderId}`,
          email: updated.customerEmail ?? null,
          value: updated.amountCents / 100,
          currency: "USD",
          contentIds: [updated.listingId],
          externalId: `order_${orderId}`,
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
