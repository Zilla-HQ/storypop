import { inngest } from "@/inngest/client";
import { db, listings, previews } from "@/db";
import { eq } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { sendPostcard } from "@/lib/lob";
import { signedR2Url, uploadToR2 } from "@/lib/r2";
import { trackEvent } from "@/lib/posthog";
import { getService, DEFAULT_SERVICE_ID } from "@/lib/services";
import { shortAddress } from "@/lib/utils";

/**
 * Postcard mailer — fires AFTER preview/ready when:
 *   - admin settings have mailerEnabled = true
 *   - the listing has a real US street address (we can mail to it)
 *
 * Built and wired but disabled-by-default. Flip on via /admin/settings
 * or by updating relist.admin_settings.mailer_enabled = true.
 */
export const mailerFn = inngest.createFunction(
  {
    id: "mailer",
    name: "Postcard mailer (Lob)",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "preview/ready" },
  async ({ event, step, logger }) => {
    const { listingId, previewId, serviceId: serviceIdRaw } = event.data;
    const serviceId = serviceIdRaw ?? DEFAULT_SERVICE_ID;
    const service = getService(serviceId);

    const settings = await step.run("load-settings", () => getSettings());
    if (!settings.mailerEnabled) {
      return { skipped: true, reason: "mailer disabled in admin settings" };
    }
    if (settings.paused) return { skipped: true, reason: "globally paused" };

    const { listing, preview } = await step.run("load-row", async () => {
      const [l] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      const [p] = await db.select().from(previews).where(eq(previews.id, previewId)).limit(1);
      return { listing: l, preview: p };
    });

    if (!listing || !preview) return { skipped: true, reason: "row missing" };
    if (!listing.address || listing.address === "Loading…") {
      return { skipped: true, reason: "no street address yet" };
    }
    if (!listing.zip || listing.zip.length < 5) {
      return { skipped: true, reason: "no zip" };
    }
    if (preview.enhancedPhotoUrls.length === 0 || preview.originalPhotoUrls.length === 0) {
      return { skipped: true, reason: "preview empty" };
    }

    // Re-host the source (zillowstatic) and signed-R2 enhanced URLs as
    // long-lived public URLs that Lob's PDF renderer can fetch.
    const { beforeUrl, afterUrl } = await step.run("rehost-images-for-print", async () => {
      const fetchAndUpload = async (sourceUrl: string, key: string): Promise<string> => {
        const res = await fetch(sourceUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        await uploadToR2(key, buf, "image/jpeg");
        return signedR2Url(key, 60 * 60 * 24 * 14); // 14-day signed URL
      };
      const [before, after] = await Promise.all([
        fetchAndUpload(
          preview.originalPhotoUrls[0],
          `postcards/${listingId}/${preview.id}-before.jpg`,
        ),
        fetchAndUpload(
          preview.enhancedPhotoUrls[0],
          `postcards/${listingId}/${preview.id}-after.jpg`,
        ),
      ]);
      return { beforeUrl: before, afterUrl: after };
    });

    const result = await step.run("lob-send", async () => {
      try {
        return await sendPostcard({
          listingId,
          to: {
            name: listing.agentName ?? "Current Resident",
            streetLine1: listing.address,
            city: listing.city,
            state: listing.state,
            zip: listing.zip,
          },
          listingSlug: listing.slug,
          serviceId,
          serviceName: service?.name ?? "Realscale",
          shortAddress: shortAddress(listing.address),
          beforeImageUrl: beforeUrl,
          afterImageUrl: afterUrl,
        });
      } catch (err) {
        logger.error(`Lob send failed: ${err}`);
        return null;
      }
    });

    if (!result) return { failed: true, reason: "lob send failed" };

    await trackEvent({
      distinctId: listingId,
      event: "postcard_sent",
      properties: {
        lob_id: result.lobId,
        service_id: serviceId,
        expected_delivery: result.expectedDeliveryDate,
      },
    });

    logger.info(
      `Mailed postcard ${result.lobId} for listing ${listingId} (delivery ~${result.expectedDeliveryDate})`,
    );
    return { lobId: result.lobId, expectedDelivery: result.expectedDeliveryDate };
  },
);
