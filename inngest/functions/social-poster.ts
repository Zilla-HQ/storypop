import { inngest } from "@/inngest/client";
import { db, listings, previews } from "@/db";
import { desc, eq, inArray, and, gt } from "drizzle-orm";
import { uploadToR2, signedR2Url } from "@/lib/r2";
import { buildSocialCard, postToPinterest } from "@/lib/social";
import { trackEvent } from "@/lib/posthog";
import { getSettings } from "@/db/settings";
import { env } from "@/lib/env";

const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

const SERVICE_CAPTIONS: Record<string, string> = {
  "pool-mockup": "Pool mockup",
  "solar-mockup": "Solar mockup",
  "curb-appeal": "Curb appeal refresh",
};

const SERVICE_HASHTAGS: Record<string, string> = {
  "pool-mockup":
    "#poolinstallation #backyardgoals #poolinspiration #homeimprovement #realestate #zillow",
  "solar-mockup":
    "#solar #solarpanels #renewableenergy #homeimprovement #netzero #savings",
  "curb-appeal":
    "#curbappeal #landscaping #frontyard #homeimprovement #realestate #beforeandafter",
};

/**
 * Daily social-poster: pick the freshest homeowner-side preview, build a
 * 9:16 social card, post to Pinterest. TikTok requires video so we stub it
 * for now — feature flag can flip when video gen is ready.
 *
 * Why daily? Pinterest rewards sustained cadence; TikTok's algo prefers 1–3
 * posts/day; FB Reels picks up Pinterest cross-posts via Meta Business Suite.
 * One queued asset/day = ~365 organic posts/year, all targeting cities we
 * already rank programmatic SEO for.
 */
export const socialPosterFn = inngest.createFunction(
  {
    id: "social-poster",
    name: "Daily social poster (Pinterest + TikTok stub)",
    retries: 1,
  },
  // 9am ET = 14:00 UTC. Pinterest engagement peaks 8–11pm but daytime
  // publishing dwells in the feed long enough to catch evening browse.
  [{ cron: "0 14 * * *" }, { event: "social-poster/manual" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) {
      return { skipped: true, reason: "global pause" };
    }

    // Pick the freshest preview from a homeowner-facing service that we
    // haven't posted yet (we mark posted ones in PostHog, not DB, to keep
    // the schema thin). For v1 we just take the most recent one and
    // accept occasional duplicate posts — Pinterest dedupes by image hash.
    const candidate = await step.run("pick-preview", async () => {
      const rows = await db
        .select({
          previewId: previews.id,
          listingId: listings.id,
          serviceId: previews.serviceId,
          enhancedPhotoUrls: previews.enhancedPhotoUrls,
          originalPhotoUrls: previews.originalPhotoUrls,
          city: listings.city,
          state: listings.state,
          slug: listings.slug,
          createdAt: previews.createdAt,
        })
        .from(previews)
        .innerJoin(listings, eq(previews.listingId, listings.id))
        .where(
          and(
            inArray(previews.serviceId, ["pool-mockup", "solar-mockup", "curb-appeal"]),
            // Past 14 days only — fresh content keeps Pinterest's algo happy.
            gt(previews.createdAt, new Date(Date.now() - 14 * 24 * 3600 * 1000)),
          ),
        )
        .orderBy(desc(previews.createdAt))
        .limit(20);

      // Prefer one with both before+after URLs.
      return rows.find(
        (r) => r.enhancedPhotoUrls.length > 0 && r.originalPhotoUrls.length > 0,
      );
    });

    if (!candidate) {
      logger.info("social-poster: no recent previews to post");
      return { skipped: true, reason: "no fresh previews" };
    }

    const before = candidate.originalPhotoUrls[0];
    const after = candidate.enhancedPhotoUrls[0];
    const cityLabel =
      candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : "your home";
    const captionTitle = `${SERVICE_CAPTIONS[candidate.serviceId] ?? "Mockup"} — ${cityLabel}`;

    // Build card and upload to R2 with public URL.
    const cardKey = await step.run("build-and-upload", async () => {
      const buf = await buildSocialCard({
        beforeUrl: before,
        afterUrl: after,
        caption: cityLabel,
      });
      const key = `social/${candidate.serviceId}/${candidate.previewId}.jpg`;
      await uploadToR2(key, buf, "image/jpeg");
      return key;
    });

    const publicImageUrl = await step.run("get-public-url", () => signedR2Url(cardKey));

    const destinationLink =
      candidate.serviceId === "pool-mockup"
        ? `${APP_URL}/renovate?utm_source=pinterest&utm_campaign=pool-mockup`
        : candidate.serviceId === "solar-mockup"
          ? `${APP_URL}/renovate?utm_source=pinterest&utm_campaign=solar-mockup`
          : `${APP_URL}/renovate?utm_source=pinterest&utm_campaign=curb-appeal`;

    const description = [
      `${SERVICE_CAPTIONS[candidate.serviceId] ?? "Mockup"} rendered on a real satellite view of a home in ${cityLabel}.`,
      `See yours free at realscale.app — type your address, get a mockup in 90 seconds. No signup.`,
      "",
      SERVICE_HASHTAGS[candidate.serviceId] ?? "",
    ].join("\n");

    // Pinterest — live.
    const pinterest = await step.run("pinterest-post", async () => {
      try {
        const r = await postToPinterest({
          imageUrl: publicImageUrl,
          title: captionTitle.slice(0, 100),
          description,
          destinationLink,
          altText: `${SERVICE_CAPTIONS[candidate.serviceId] ?? "Mockup"} for a home in ${cityLabel}`,
        });
        return { ok: true as const, pinId: r.pinId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Pinterest post failed: ${msg}`);
        return { ok: false as const, error: msg.slice(0, 200) };
      }
    });

    await trackEvent({
      distinctId: candidate.previewId,
      event: "social_pinterest_posted",
      properties: {
        ok: pinterest.ok,
        service_id: candidate.serviceId,
        listing_id: candidate.listingId,
        city: candidate.city,
        state: candidate.state,
        ...("pinId" in pinterest ? { pin_id: pinterest.pinId } : {}),
        ...("error" in pinterest ? { error: pinterest.error } : {}),
      },
    });

    // TikTok — currently stubbed. The card is image-only; TikTok needs
    // video. Once we add an ffmpeg ken-burns step to produce a 5s mp4,
    // flip the env flag and uncomment.
    //
    // if (env("TIKTOK_ACCESS_TOKEN")) {
    //   await step.run("tiktok-publish", () =>
    //     postToTikTokInbox({
    //       videoUrl: videoPublicUrl,
    //       title: captionTitle,
    //     }),
    //   );
    // }

    return {
      previewId: candidate.previewId,
      serviceId: candidate.serviceId,
      pinterest,
      socialCardKey: cardKey,
    };
  },
);
