import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings, orders } from "@/db";
import { eq } from "drizzle-orm";
import { stripe, publicAppUrl } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getService } from "@/lib/services";
import { trackEvent } from "@/lib/posthog";
import { sendMetaEvent } from "@/lib/meta-capi";

export const runtime = "nodejs";

/**
 * StoryPop checkout: takes a book (the parent-submitted form) + chosen
 * SKU, creates a one-time Stripe Checkout session, persists a `pending`
 * order. Stripe webhook flips it to `paid` and fires `orders/paid`, which
 * the fulfillment Inngest function picks up to render the rest of the
 * book and dispatch PDF email or Lulu print job.
 *
 * Stripe price IDs by SKU live in env (see lib/services.ts:stripePriceEnv).
 * For print SKUs (softcover/hardcover/bundle), the buyer must include a
 * shipping address in the body.
 */

const shippingSchema = z.object({
  name: z.string().min(1).max(120),
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  stateCode: z.string().min(2).max(3),
  postcode: z.string().min(3).max(20),
  countryCode: z.string().length(2),
  phone: z.string().max(40).optional(),
});

const bodySchema = z.object({
  bookId: z.string().uuid(),
  serviceId: z.enum(["pdf", "softcover", "hardcover", "gift-bundle"]),
  rush: z.boolean().optional(),
  customerEmail: z.string().email(),
  shipping: shippingSchema.optional(),
  eventId: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", details: String(err) },
      { status: 400 },
    );
  }

  const sku = getService(body.serviceId);
  if (!sku) {
    return NextResponse.json({ error: "Unknown SKU" }, { status: 400 });
  }
  if (sku.fulfillment !== "digital_pdf" && !body.shipping) {
    return NextResponse.json(
      { error: "Print SKUs require a shipping address" },
      { status: 400 },
    );
  }

  const [book] = await db.select().from(listings).where(eq(listings.id, body.bookId));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const priceId = env(sku.stripePriceEnv);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price id missing — set ${sku.stripePriceEnv}` },
      { status: 500 },
    );
  }

  const amountCents = body.rush && sku.rushPriceCents ? sku.rushPriceCents : sku.basePriceCents;

  const [order] = await db
    .insert(orders)
    .values({
      listingId: book.id,
      serviceId: sku.id,
      rush: body.rush ?? false,
      amountCents,
      customerEmail: body.customerEmail,
      shipping: body.shipping ?? null,
      status: "pending",
    })
    .returning({ id: orders.id });
  if (!order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const baseUrl = publicAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: body.customerEmail,
    success_url: `${baseUrl}/delivery/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/preview/${book.id}?canceled=1`,
    client_reference_id: order.id,
    payment_intent_data: {
      metadata: {
        order_id: order.id,
        book_id: book.id,
        sku: sku.id,
      },
    },
    metadata: {
      order_id: order.id,
      book_id: book.id,
      sku: sku.id,
    },
    // Collect shipping at Stripe Checkout for print SKUs even though we
    // already have it — Stripe also pulls tax + handles address validation.
    shipping_address_collection:
      sku.fulfillment === "digital_pdf"
        ? undefined
        : { allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "NL"] },
  });

  await db
    .update(orders)
    .set({ stripeSessionId: session.id })
    .where(eq(orders.id, order.id));

  await Promise.allSettled([
    trackEvent({
      distinctId: book.id,
      event: "checkout_initiated",
      properties: { orderId: order.id, sku: sku.id },
    }),
    sendMetaEvent("InitiateCheckout", {
      bookId: book.id,
      eventId: body.eventId,
      value: amountCents / 100,
    }).catch(() => {}),
  ]);

  return NextResponse.json({
    sessionId: session.id,
    url: session.url,
    orderId: order.id,
  });
}
