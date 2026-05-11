import { inngest } from "@/inngest/client";
import { db, listings, previews } from "@/db";
import { eq } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { generateStagedPreview } from "@/lib/falai";
import { uploadToR2, signedR2Url } from "@/lib/r2";
import { applyTextWatermark } from "@/lib/watermark";
import { trackAgentCost, getTodaySpendCents } from "@/lib/costs";
import { trackEvent } from "@/lib/posthog";
import { pickBestForStaging, classifyRoom, type RoomKind } from "@/lib/room-classify";
import { getService, requireService, DEFAULT_SERVICE_ID } from "@/lib/services";
import { analyzeFloorPlan } from "@/lib/floorplan";
import { geocodeAddress, satelliteTileUrl } from "@/lib/mapbox";

const MAX_PREVIEW_COST_CENTS = 12; // $0.12/preview cap per spec

const ROOM_HINT_TEXT: Record<RoomKind, string> = {
  kitchen: "kitchen",
  living_room: "living room",
  dining_room: "dining room",
  bedroom: "bedroom",
  bathroom: "bathroom",
  office: "home office",
  exterior_front: "front exterior of the house",
  exterior_back: "back exterior of the house",
  patio: "outdoor patio",
  pool: "pool area",
  garage: "garage",
  hallway: "hallway",
  floor_plan: "floor plan",
  other: "interior room",
};

export const previewFn = inngest.createFunction(
  {
    id: "preview",
    name: "Agent 3 — Preview",
    retries: 2,
    concurrency: { limit: 6 },
  },
  // Generate previews on both paths:
  //   - listings/qualified — autonomous cron path (every qualified listing
  //     gets a personalized preview pre-rendered for cold email)
  //   - preview/requested — lazy path for /l/<slug> visitors (manual
  //     re-generations or backfills)
  [{ event: "listings/qualified" }, { event: "preview/requested" }],
  async ({ event, step, logger }) => {
    const { listingId, serviceId: serviceIdRaw } = event.data;
    const service =
      (serviceIdRaw ? getService(serviceIdRaw) : undefined) ??
      requireService(DEFAULT_SERVICE_ID);
    const serviceId = service.id;

    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.previewPaused) {
      return { skipped: true, reason: "paused" };
    }

    // Daily cap — count previews created today
    const spentToday = await step.run("check-daily-budget", () => getTodaySpendCents("preview"));
    // Rough cap: (cap * cost per preview) cents
    if (spentToday >= settings.previewDailyCap * MAX_PREVIEW_COST_CENTS) {
      logger.warn(`Preview daily cap hit: ${spentToday} cents`);
      return { skipped: true, reason: "daily cap hit" };
    }

    const listing = await step.run("load-listing", async () => {
      const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      return row;
    });
    if (!listing) {
      return { skipped: true, reason: "listing missing" };
    }

    const isSatelliteService = service.imageSource === "satellite_tile";
    if (!isSatelliteService && (!listing.photos || listing.photos.length === 0)) {
      return { skipped: true, reason: "no photos" };
    }

    // For satellite-tile services (pool, solar) we synthesize the source
    // image from a Mapbox satellite tile of the property's geocoded lat/lng,
    // not from MLS photos.
    type Selection = { url: string; roomKind: RoomKind; empty: boolean; stagingValue: number };
    let selected: Selection[];
    if (isSatelliteService) {
      // Pull THREE satellite tiles at different zooms so the homeowner sees
      // wide-context, lot-tight, and close-up renders. Variety > one render.
      selected = await step.run("fetch-satellite-tiles", async (): Promise<Selection[]> => {
        const fullAddress = [listing.address, listing.city, listing.state, listing.zip]
          .filter(Boolean)
          .join(", ");
        const geo = await geocodeAddress(fullAddress);
        if (!geo) {
          logger.error(`Geocode failed for "${fullAddress}"`);
          return [];
        }
        const zooms = [18.5, 19.5, 20]; // wide → tight → tightest
        const roomKind = service.id === "pool-mockup" ? "patio" : "exterior_front";
        return zooms.map((zoom) => ({
          url: satelliteTileUrl({ lng: geo.lng, lat: geo.lat, zoom }),
          roomKind,
          empty: true,
          stagingValue: 5,
        }));
      });
    } else {
      selected = await step.run("select-photos", async (): Promise<Selection[]> => {
        const ranked = await pickBestForStaging(listing.photos, 2);
        return ranked.map((r) => ({
          url: r.url,
          roomKind: r.classification.kind,
          empty: r.classification.empty,
          stagingValue: r.classification.stagingValue,
        }));
      });
    }
    if (selected.length === 0) {
      return { skipped: true, reason: "no source images" };
    }

    // Floor plan analysis: scan the FIRST few photos for a floor plan and,
    // if found, generate renovation recommendations. Stored on the listing
    // so the personalized landing page can render them.
    await step.run("floorplan-analysis", async () => {
      // Skip if we already analyzed this listing
      if (listing.floorplanRecommendations || listing.floorplanSourceUrl) return;
      // Only check the first 8 photos — floor plans are usually near the start
      const candidates = listing.photos.slice(0, 8);
      let floorplanUrl: string | null = null;
      for (const url of candidates) {
        const cls = await classifyRoom(url);
        if (cls.kind === "floor_plan") {
          floorplanUrl = url;
          break;
        }
      }
      if (!floorplanUrl) return;
      logger.info(`Floor plan detected: ${floorplanUrl}`);
      const analysis = await analyzeFloorPlan(floorplanUrl);
      if (!analysis) return;
      await db
        .update(listings)
        .set({
          floorplanRecommendations: analysis,
          floorplanSourceUrl: floorplanUrl,
        })
        .where(eq(listings.id, listingId));
    });

    const defaultStyle = settings.stylePresets[0];
    if (!defaultStyle) {
      return { skipped: true, reason: "no style presets configured" };
    }

    const generated = await step.run("generate-previews", async () => {
      const out: { enhancedUrl: string; costCents: number; sourceUrl: string }[] = [];
      // For non-photo-staging services (pool, solar, twilight, curb-appeal),
      // the service.promptTemplate is the canonical instruction set —
      // Kontext gets the exact prompt the catalog defines.
      // For photo-staging specifically, we let the mode flag drive the prompt
      // so we do staging-on-empty / enhancement-on-furnished and never apply
      // a "stage this room" prompt to a populated photo (which makes Kontext
      // hallucinate a different scene).
      const isPhotoStaging = service.id === "photo-staging";
      const servicePrompt = isPhotoStaging
        ? undefined
        : service.promptTemplate.replace("{{styleFragment}}", defaultStyle.promptFragment);

      for (const sel of selected) {
        const mode: "staging" | "enhancement" = sel.empty ? "staging" : "enhancement";
        try {
          const r = await generateStagedPreview({
            sourceImageUrl: sel.url,
            styleFragment: defaultStyle.promptFragment,
            roomHint: ROOM_HINT_TEXT[sel.roomKind] ?? "interior room",
            servicePrompt,
            mode,
          });
          out.push({ enhancedUrl: r.url, costCents: r.costCents, sourceUrl: sel.url });
        } catch (err) {
          logger.error(`fal.ai generation failed (mode=${mode}): ${err}`);
        }
      }
      return out;
    });

    if (generated.length === 0) {
      return { skipped: true, reason: "all generations failed" };
    }

    const watermarked = await step.run("watermark-and-upload", async () => {
      const uploaded: string[] = [];
      for (let i = 0; i < generated.length; i++) {
        const g = generated[i];
        const res = await fetch(g.enhancedUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const stamped = await applyTextWatermark(buf, "PREVIEW — Realscale", {
          position: "bottom-right",
          opacity: 0.75,
        });
        const key = `previews/${listingId}/${Date.now()}-${i}.jpg`;
        await uploadToR2(key, stamped, "image/jpeg");
        uploaded.push(await signedR2Url(key, 60 * 60 * 24 * 7));
      }
      return uploaded;
    });

    const costCents = generated.reduce((sum, g) => sum + g.costCents, 0);

    const [preview] = await step.run("write-preview-row", async () => {
      return db
        .insert(previews)
        .values({
          listingId,
          serviceId,
          originalPhotoUrls: generated.map((g) => g.sourceUrl),
          enhancedPhotoUrls: watermarked,
          stylePreset: defaultStyle.id,
          costCents,
        })
        .returning();
    });

    await step.run("track-cost", () => trackAgentCost("preview", costCents));

    await step.sendEvent("emit-preview-ready", {
      name: "preview/ready",
      data: { listingId, previewId: preview.id, serviceId },
    });

    await trackEvent({
      distinctId: listingId,
      event: "preview_ready",
      properties: {
        preview_id: preview.id,
        cost_cents: costCents,
        style: defaultStyle.id,
        service_id: serviceId,
      },
    });

    return { previewId: preview.id, enhancedCount: watermarked.length, costCents };
  },
);
