import archiver from "archiver";
import { env } from "@/lib/env";
import { PassThrough } from "stream";
import { inngest } from "@/inngest/client";
import { db, orders, listings, outreachEvents } from "@/db";
import { eq } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { stagePhoto, inferMode } from "@/lib/staging-api";
import { qcStagedPhoto } from "@/lib/vision";
import { applyTextWatermark } from "@/lib/watermark";
import { uploadToR2, signedR2Url, r2Bucket } from "@/lib/r2";
import { stripe } from "@/lib/stripe";
import { sendComplianceEmail } from "@/lib/resend";
import { trackAgentCost } from "@/lib/costs";
import { trackEvent } from "@/lib/posthog";
import { shortAddress } from "@/lib/utils";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const QC_PASS_THRESHOLD = 3;          // 1-5 scale; 3 = "acceptable", 4 = "good"
const QC_RETRY_SEED_BUMP = 1;
const MIN_PHOTOS_FOR_DELIVERY = 1;    // Any successful enhancement ships (was 8)

export const fulfillmentFn = inngest.createFunction(
  {
    id: "fulfillment",
    name: "Agent 5 — Fulfillment",
    retries: 3,
    concurrency: { limit: 4 },
  },
  { event: "orders/paid" },
  async ({ event, step, logger }) => {
    const { orderId } = event.data;

    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.fulfillmentPaused) {
      return { skipped: true, reason: "paused" };
    }

    const { order, listing } = await step.run("load-order-and-listing", async () => {
      const [row] = await db
        .select({ order: orders, listing: listings })
        .from(orders)
        .innerJoin(listings, eq(orders.listingId, listings.id))
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!row) throw new Error(`Order ${orderId} not found`);
      return row;
    });

    if (order.status !== "paid") {
      return { skipped: true, reason: `unexpected status ${order.status}` };
    }

    await step.run("mark-fulfilling", async () => {
      await db.update(orders).set({ status: "fulfilling" }).where(eq(orders.id, orderId));
    });

    const sourceUrls = await step.run("fetch-all-photos", () => listing.photos);

    // Stage each photo — per-photo step.run for Inngest idempotency + progress.
    const staged: { key: string; cost: number }[] = [];
    let totalCost = 0;

    for (let i = 0; i < sourceUrls.length; i++) {
      const src = sourceUrls[i];
      const result = await step.run(`stage-photo-${i}`, async () => {
        const mode = inferMode(src, i);
        try {
          return await stagePhoto({
            sourceImageUrl: src,
            mode,
            stylePreset: order.stylePreset,
            roomHint: i === 0 ? "exterior" : "living_room",
          });
        } catch (err) {
          logger.error(`Staging failed for photo ${i}: ${err}`);
          return null;
        }
      });
      if (!result) continue;

      // QC gate
      const qc = await step.run(`qc-${i}`, () => qcStagedPhoto(result.url));
      let finalUrl = result.url;
      if (qc.score < QC_PASS_THRESHOLD) {
        logger.warn(`QC failed for photo ${i} (${qc.score}/${qc.artifacts}) — retrying once`);
        const retry = await step.run(`stage-retry-${i}`, async () => {
          try {
            return await stagePhoto({
              sourceImageUrl: src,
              mode: inferMode(src, i + QC_RETRY_SEED_BUMP),
              stylePreset: order.stylePreset,
              roomHint: i === 0 ? "exterior" : "living_room",
            });
          } catch (err) {
            logger.error(`Retry failed for photo ${i}: ${err}`);
            return null;
          }
        });
        if (!retry) continue;
        const qc2 = await step.run(`qc-retry-${i}`, () => qcStagedPhoto(retry.url));
        if (qc2.score < QC_PASS_THRESHOLD) {
          logger.warn(`QC still failed after retry for photo ${i} — excluding from delivery`);
          continue;
        }
        finalUrl = retry.url;
        totalCost += retry.costCents;
      }
      totalCost += result.costCents;

      // Add NAR disclosure + upload to R2.
      const stored = await step.run(`stamp-and-upload-${i}`, async () => {
        const res = await fetch(finalUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const stamped = await applyTextWatermark(buf, "Virtually Staged", {
          position: "bottom-left",
          opacity: 0.7,
        });
        const key = `deliveries/${order.id}/${String(i).padStart(3, "0")}.jpg`;
        await uploadToR2(key, stamped, "image/jpeg");
        return { key, cost: totalCost };
      });
      staged.push({ key: stored.key, cost: totalCost });
    }

    if (staged.length < MIN_PHOTOS_FOR_DELIVERY) {
      // Auto-refund and alert.
      await step.run("auto-refund", async () => {
        if (order.stripePaymentIntentId) {
          await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            reason: "requested_by_customer",
          });
        }
        await db
          .update(orders)
          .set({ status: "refunded" })
          .where(eq(orders.id, orderId));
      });
      await step.sendEvent("emit-fulfillment-failed", {
        name: "orders/fulfillment_failed",
        data: {
          orderId,
          reason: `Only ${staged.length} photos passed QC (minimum ${MIN_PHOTOS_FOR_DELIVERY})`,
        },
      });
      return {
        failed: true,
        reason: `insufficient photos: ${staged.length}/${MIN_PHOTOS_FOR_DELIVERY}`,
      };
    }

    // Build zip of all staged photos.
    const zipKey = await step.run("package-zip", () => packageZip(staged.map((s) => s.key), order.id));
    const zipUrl = await step.run("sign-zip-url", () => signedR2Url(zipKey, 60 * 60 * 24 * 30));

    const deliveryUrl = `${env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!}/delivery/${order.id}`;

    const stagedUrls = await step.run("sign-gallery-urls", async () => {
      return Promise.all(staged.map((s) => signedR2Url(s.key, 60 * 60 * 24 * 30)));
    });

    await step.run("update-delivery-info", async () => {
      await db
        .update(orders)
        .set({ zipUrl, deliveryUrl })
        .where(eq(orders.id, orderId));
    });

    await step.run("send-delivery-email", async () => {
      if (!order.customerEmail) return;
      const mjml = `<mjml><mj-body>
        <mj-section padding="20px"><mj-column>
          <mj-text font-size="20px" font-weight="700">Your photos are ready.</mj-text>
          <mj-text>Full enhanced set for <b>${shortAddress(listing.address)}</b> — ${staged.length} photos, stamped per NAR guidance.</mj-text>
          <mj-button href="${deliveryUrl}" background-color="#111827" color="#ffffff" border-radius="8px">View gallery</mj-button>
          <mj-text><a href="${zipUrl}">Download zip</a></mj-text>
        </mj-column></mj-section>
      </mj-body></mjml>`;
      const subject = `Your enhanced photos are ready — ${shortAddress(listing.address)}`;
      const text = `Your enhanced photos for ${listing.address} are ready.\n\nView: ${deliveryUrl}\nDownload zip: ${zipUrl}`;
      const domain = settings.senderDomains[0] ?? "mail.realscale.app";

      // Pre-insert into outreach_events so the customer-facing delivery email
      // shows up alongside cold-outreach in /admin/outreach with open/click tracking.
      const [evt] = await db
        .insert(outreachEvents)
        .values({
          listingId: listing.id,
          channel: "email",
          templateId: "delivery_v1",
          senderDomain: domain,
          subject,
          body: text,
          status: "queued",
        })
        .returning();

      const r = await sendComplianceEmail({
        to: order.customerEmail,
        fromDomain: domain,
        subject,
        mjml,
        text,
        listingId: listing.id,
        idempotencyKey: `delivery_${orderId}`,
      });

      await db
        .update(outreachEvents)
        .set({ resendId: r.id, status: "sent", sentAt: new Date() })
        .where(eq(outreachEvents.id, evt.id));
    });

    await step.run("mark-fulfilled", async () => {
      await db
        .update(orders)
        .set({ status: "fulfilled", fulfilledAt: new Date() })
        .where(eq(orders.id, orderId));
    });

    await step.run("track-costs", () => trackAgentCost("fulfillment", totalCost));

    await step.sendEvent("emit-fulfilled", {
      name: "orders/fulfilled",
      data: { orderId },
    });

    await trackEvent({
      distinctId: orderId,
      event: "order_fulfilled",
      properties: {
        photo_count: staged.length,
        cost_cents: totalCost,
        tier: order.tier,
      },
    });

    logger.info(`Fulfilled order ${orderId}: ${staged.length} photos, $${(totalCost / 100).toFixed(2)} cost`);

    return {
      orderId,
      photoCount: staged.length,
      costCents: totalCost,
      deliveryUrl,
      zipUrl,
      galleryUrls: stagedUrls,
    };
  },
);

/**
 * Stream R2 objects through archiver into a new R2 object.
 * Uses S3 multipart upload via PutObject (archive is buffered in memory).
 * For very large deliveries (>100 photos) replace with a chunked upload.
 */
async function packageZip(keys: string[], orderId: string): Promise<string> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing — cannot package zip");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const zipKey = `deliveries/${orderId}/photos.zip`;

  const archive = archiver("zip", { zlib: { level: 6 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  // Pipe each R2 object into the archive in order.
  for (const key of keys) {
    const res = await fetch(await signedR2Url(key, 60 * 5));
    if (!res.ok || !res.body) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    archive.append(buf, { name: key.split("/").pop() ?? key });
  }
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of pass) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);

  await s3.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: zipKey,
      Body: body,
      ContentType: "application/zip",
    }),
  );

  return zipKey;
}
