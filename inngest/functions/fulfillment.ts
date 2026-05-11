import { inngest } from "@/inngest/client";
import { db, orders, listings } from "@/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { uploadToR2, signedR2Url } from "@/lib/r2";
import { sendComplianceEmail } from "@/lib/resend";
import { trackAgentCost } from "@/lib/costs";
import { trackEvent } from "@/lib/posthog";
import {
  generatePageIllustration,
  ContentSafetyError,
  type StylePreset,
} from "@/lib/falai";
import { createPrintJob, type LuluLineItem } from "@/lib/lulu";
import { requireService } from "@/lib/services";

/**
 * StoryPop fulfillment: on `orders/paid`, render the remaining pages
 * (4–16), assemble the PDF, and either deliver it (PDF SKU) or submit
 * a Lulu print job (softcover / hardcover / bundle).
 *
 * Auto-refund triggers: ≥2 safety-gate failures on any page → cancel
 * the order, refund via Stripe, email the buyer.
 *
 * No watermark stamping. No virtual staging. Pure book-generation +
 * print fulfillment.
 */

const RUSH_SHIPPING_LEVELS = {
  MAIL: "MAIL",
  GROUND: "GROUND",
  EXPEDITED: "EXPEDITED",
} as const;

export const fulfillment = inngest.createFunction(
  {
    id: "fulfillment",
    name: "StoryPop — render remaining pages + fulfill SKU",
    retries: 1,
  },
  { event: "orders/paid" },
  async ({ event, step, logger }) => {
    const { orderId } = event.data;

    const order = await step.run("load-order", async () => {
      const rows = await db.select().from(orders).where(eq(orders.id, orderId));
      return rows[0] ?? null;
    });
    if (!order) {
      logger.warn({ orderId }, "fulfillment: order not found");
      return { skipped: "order-not-found" };
    }

    const book = await step.run("load-book", async () => {
      const rows = await db.select().from(listings).where(eq(listings.id, order.listingId));
      return rows[0] ?? null;
    });
    if (!book) return { skipped: "book-not-found" };

    const sku = requireService((order.serviceId as string) ?? "hardcover");
    const story = book.story as { pages: { sceneDescription: string; body: string }[] } | null;
    if (!story || !Array.isArray(story.pages)) {
      return { error: "no-story-on-book" };
    }

    const stylePreset: StylePreset = (book.stylePreset as StylePreset) ?? "picture-book-warm";
    const loraId = book.loraId as string;
    const isDefaultLora = !loraId || loraId.startsWith("default::");

    // ─── 1. Render pages 4..N (free preview covers 0..3) ────────────────
    const previewPages = ((book.previewPages as { pageNumber: number; r2Key: string }[] | null) ?? []).map(
      (p) => p.pageNumber,
    );
    let safetyFails = 0;
    for (let i = 0; i < story.pages.length; i++) {
      if (previewPages.includes(i)) continue;
      try {
        const result = await step.run(`gen-page-${i}`, () =>
          generatePageIllustration({
            loraId,
            isDefaultLora,
            sceneDescription: story.pages[i].sceneDescription,
            stylePreset,
            pageNumber: i,
            childName: book.childName as string,
          }),
        );
        const r2Key = `books/${book.id}/pages/${i}.png`;
        await step.run(`upload-page-${i}`, () => uploadToR2(r2Key, result.imageUrl));
      } catch (err) {
        if (err instanceof ContentSafetyError) {
          safetyFails++;
          if (safetyFails >= 2) {
            return await autoRefund(step, { orderId, order, book, reason: err.message });
          }
        } else {
          throw err;
        }
      }
    }

    // ─── 2. Assemble the PDF ─────────────────────────────────────────────
    // The PDF builder is a small helper; deferred to a separate step so
    // the cost is observable and retriable.
    const pdfR2Key = `books/${book.id}/final.pdf`;
    await step.run("assemble-pdf", async () => {
      // Implementation: render react-pdf with the story.pages text + page
      // image URLs. Stamp dedication page footer. Upload to R2.
      // (Stub here — see lib/pdf-builder.ts in v2.)
      logger.info({ bookId: book.id }, "TODO: assemble PDF via react-pdf");
      return { uploaded: pdfR2Key };
    });

    await db
      .update(listings)
      .set({ finalPdfUrl: pdfR2Key, updatedAt: new Date() })
      .where(eq(listings.id, book.id));

    // ─── 3. Fulfill the SKU ──────────────────────────────────────────────
    if (sku.fulfillment === "digital_pdf") {
      const url = await signedR2Url(pdfR2Key, 7 * 24 * 60 * 60);
      await sendComplianceEmail({
        to: order.customerEmail ?? "",
        subject: `${book.childName}'s book is ready`,
        html: pdfDeliveryHtml({ childName: book.childName as string, pdfUrl: url }),
      });
    } else {
      const lineItem: LuluLineItem =
        sku.fulfillment === "lulu_hardcover" || sku.fulfillment === "lulu_plus_printful_plush"
          ? "hardcover"
          : "softcover";
      const job = await step.run("create-print-job", () =>
        createPrintJob({
          externalId: order.id as string,
          lineItem,
          pageCount: sku.pageCount,
          interiorPdfUrl: pdfR2Key,
          coverPdfUrl: `books/${book.id}/cover.pdf`,
          shipping: order.shipping as never,
          shippingLevel: order.rush ? RUSH_SHIPPING_LEVELS.EXPEDITED : RUSH_SHIPPING_LEVELS.GROUND,
        }),
      );
      await step.sendEvent("track-print", {
        name: "print-job/submitted",
        data: { orderId: order.id, luluJobId: job.id },
      });
    }

    await step.run("track-cost", () =>
      trackAgentCost({
        agent: "fulfillment",
        listingId: book.id,
        cents: (story.pages.length - previewPages.length) * 4,
      }),
    );
    await step.run("track-event", () =>
      trackEvent("order_fulfilled", { orderId, sku: sku.id }),
    );

    return { fulfilled: true, sku: sku.id };
  },
);

async function autoRefund(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: any,
  args: {
    orderId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    book: any;
    reason: string;
  },
) {
  await step.run("stripe-refund", async () => {
    if (!args.order.stripePaymentIntentId) return;
    await stripe.refunds.create({ payment_intent: args.order.stripePaymentIntentId });
  });
  await step.run("notify-customer", async () => {
    await sendComplianceEmail({
      to: args.order.customerEmail ?? "",
      subject: `Refund issued — ${args.book.childName}'s book`,
      html: `<p>Hi —</p><p>I tried twice to draw a page for ${args.book.childName}'s book and my safety filter blocked both versions. Rather than ship something I'm not proud of, I've issued a full refund.</p><p>If you'd like to try again with a different story idea, just visit storypop.shop/create. No charge until you see the new preview.</p><p>— Pip</p>`,
    });
  });
  await step.run("track-event", () =>
    trackEvent("order_auto_refunded", { orderId: args.orderId, reason: args.reason }),
  );
  return { autoRefunded: true, reason: args.reason };
}

function pdfDeliveryHtml(args: { childName: string; pdfUrl: string }): string {
  return `<p>Hi —</p>
<p>${args.childName}'s book is finished.</p>
<p><a href="${args.pdfUrl}">Download the PDF</a> (link works for 7 days).</p>
<p>If anything's off — a misspelled name, a page that doesn't feel right — reply to this email and I'll fix it.</p>
<p>— Pip</p>`;
}

export { stripe };
