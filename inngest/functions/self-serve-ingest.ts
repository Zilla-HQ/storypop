import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";
import { env } from "@/lib/env";
import { DEFAULT_SERVICE_ID, getService } from "@/lib/services";

const token = env("APIFY_TOKEN");

/**
 * Run an Apify actor synchronously and get items back, all via plain HTTP.
 * Sidesteps the apify-client SDK's dynamic `require('proxy-agent')` which
 * webpack can't resolve in the Vercel bundle.
 */
async function runApifySync(actorId: string, input: unknown): Promise<unknown[]> {
  if (!token) throw new Error("APIFY_TOKEN not set");
  // Apify accepts actor IDs as `username~actor-name` in REST API
  const id = actorId.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${id}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify ${actorId} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as unknown[];
}

/**
 * Self-serve: run an Apify scrape for one specific listing URL, backfill
 * the stub row with real data, then emit listings/qualified so the
 * existing preview pipeline takes over.
 */
export const selfServeIngestFn = inngest.createFunction(
  {
    id: "self-serve-ingest",
    name: "Self-serve ingest (one URL → scrape → emit qualified)",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "self-serve/submitted" },
  async ({ event, step, logger }) => {
    const { listingId, url, source, serviceId: rawServiceId } = event.data;
    const requested = rawServiceId ? getService(rawServiceId) : undefined;
    const service = requested ?? getService(DEFAULT_SERVICE_ID)!;

    if (!token) {
      logger.error("APIFY_TOKEN not set — self-serve ingest cannot run");
      return { skipped: true, reason: "no Apify token" };
    }

    // Normalize INSIDE the step so the step output stays small (~5KB).
    const result = await step.run("apify-single-url", async () => {
      const actorId = pickActor(source);
      const input = buildInput(source, url);
      try {
        const items = await runApifySync(actorId, input);
        if (!items[0]) {
          return { ok: false, reason: "no items in dataset", actorId };
        }
        return {
          ok: true,
          normalized: normalize(source, items[0] as Record<string, unknown>),
          actorId,
        };
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        return { ok: false, reason: `exception: ${msg.slice(0, 200)}`, actorId };
      }
    });

    if (!result.ok || !("normalized" in result)) {
      await step.run("mark-scrape-failed", async () => {
        const reason = `self-serve scrape failed: ${"reason" in result ? result.reason : "unknown"}`;
        await db
          .update(listings)
          .set({ qualificationReason: reason.slice(0, 250), qualified: false })
          .where(eq(listings.id, listingId));
      });
      return { failed: true, ...result };
    }
    const normalized = result.normalized;

    // Enrich the stub row with real scrape data.
    const updated = await step.run("update-listing", async () => {
      const baseSlug = slugify(`${normalized.address} ${normalized.zip}`);
      const slug = baseSlug ? `${baseSlug}-${listingId.slice(0, 6)}` : undefined;
      const [row] = await db
        .update(listings)
        .set({
          address: normalized.address || "Unknown address",
          city: normalized.city ?? "",
          state: normalized.state ?? "",
          zip: normalized.zip ?? "",
          price: normalized.price ?? 0,
          dom: normalized.dom ?? null,
          photos: normalized.photos,
          agentName: normalized.agentName ?? null,
          agentEmail: normalized.agentEmail ?? null,
          agentPhone: normalized.agentPhone ?? null,
          brokerage: normalized.brokerage ?? null,
          ...(slug ? { slug } : {}),
        })
        .where(eq(listings.id, listingId))
        .returning();
      return row;
    });

    // For services that operate on the property's listing photos (staging,
    // twilight, curb appeal), we need at least one MLS photo. For services
    // that operate on a satellite tile (pool-mockup, solar-mockup), the
    // address is enough — the preview pipeline will fetch the tile.
    const needsMlsPhotos = service.imageSource !== "satellite_tile";
    if (needsMlsPhotos && (!updated.photos || updated.photos.length === 0)) {
      await step.run("mark-nophotos", async () => {
        await db
          .update(listings)
          .set({ qualificationReason: "self-serve: listing had no photos", qualified: false })
          .where(eq(listings.id, listingId));
      });
      return { failed: true, reason: "no photos in scrape" };
    }

    // Kick the existing preview pipeline. The serviceId tells previewFn
    // which prompt template + image source to use.
    await step.sendEvent("emit-qualified", {
      name: "listings/qualified",
      data: { listingId, serviceId: service.id },
    });

    await trackEvent({
      distinctId: listingId,
      event: "self_serve_scraped",
      properties: {
        source,
        photo_count: updated.photos.length,
        price_cents: updated.price,
      },
    });

    return { listingId, slug: updated.slug, photos: updated.photos.length };
  },
);

function pickActor(source: "zillow" | "redfin" | "realtor"): string {
  // Different actors for SEARCH (Discovery cron) vs DETAIL (self-serve URL drop).
  // For self-serve, we want the detail-page scrapers.
  switch (source) {
    case "zillow":
      return process.env.APIFY_ZILLOW_DETAIL_ACTOR ?? "maxcopell/zillow-detail-scraper";
    case "redfin":
      return process.env.APIFY_REDFIN_DETAIL_ACTOR ?? "tugkan/redfin-scraper";
    case "realtor":
      return process.env.APIFY_REALTOR_DETAIL_ACTOR ?? "epctex/realtor-scraper";
  }
}

function buildInput(source: "zillow" | "redfin" | "realtor", url: string): unknown {
  switch (source) {
    case "zillow":
      // maxcopell/zillow-detail-scraper accepts startUrls
      return { startUrls: [{ url }] };
    case "redfin":
      return { startUrls: [{ url }], maxItems: 1 };
    case "realtor":
      return { startUrls: [url], maxItems: 1 };
  }
}

interface Normalized {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  dom?: number;
  photos: string[];
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
  brokerage?: string;
}

function normalize(
  source: "zillow" | "redfin" | "realtor",
  raw: Record<string, unknown>,
): Normalized {
  switch (source) {
    case "zillow":
      return normalizeZillow(raw);
    case "redfin":
      return normalizeRedfin(raw);
    case "realtor":
      return normalizeRealtor(raw);
  }
}

function normalizeZillow(r: Record<string, unknown>): Normalized {
  const priceDollars = Number(r.price ?? r.unformattedPrice ?? 0);

  // Extract address — zillow-detail-scraper returns address as an object
  const addrObj = (typeof r.address === "object" && r.address !== null
    ? (r.address as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const street = String(r.streetAddress ?? addrObj.streetAddress ?? "").trim();
  const city = String(r.city ?? addrObj.city ?? "").trim();
  const state = String(r.state ?? addrObj.state ?? "").trim();
  const zip = String(r.zipcode ?? addrObj.zipcode ?? r.zip ?? "").trim();

  // Photos: prefer originalPhotos[].mixedSources.jpeg[] (largest variant)
  // Fall back to responsivePhotos, then plain photos array, then imgSrc.
  type MixedSrc = { url?: string; width?: number };
  type PhotoEntry = {
    url?: string;
    mixedSources?: { jpeg?: MixedSrc[]; webp?: MixedSrc[] };
  };
  const pickFromMixed = (arr: PhotoEntry[]) =>
    arr
      .map((p) => {
        if (p.url) return p.url;
        const sources = p.mixedSources?.jpeg ?? p.mixedSources?.webp ?? [];
        // Pick the highest-width variant if width info available, else last entry.
        const sorted = [...sources].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
        return sorted[0]?.url ?? "";
      })
      .filter(Boolean);

  let photos: string[] = [];
  if (Array.isArray(r.originalPhotos)) photos = pickFromMixed(r.originalPhotos as PhotoEntry[]);
  if (photos.length === 0 && Array.isArray(r.responsivePhotos))
    photos = pickFromMixed(r.responsivePhotos as PhotoEntry[]);
  if (photos.length === 0 && Array.isArray(r.photos))
    photos = (r.photos as { url?: string }[]).map((p) => p.url ?? "").filter(Boolean);
  if (photos.length === 0 && Array.isArray(r.imgSrc)) photos = r.imgSrc as string[];

  const attr = (r.attributionInfo ?? {}) as Record<string, unknown>;
  return {
    address: street,
    city,
    state,
    zip,
    price: Math.round(priceDollars * 100) || undefined,
    dom: typeof r.daysOnZillow === "number" ? (r.daysOnZillow as number) : undefined,
    photos,
    agentName: (attr.agentName as string | undefined) ?? undefined,
    agentEmail: (attr.agentEmail as string | undefined) ?? undefined,
    agentPhone: (attr.agentPhoneNumber as string | undefined) ?? undefined,
    brokerage: (attr.brokerName as string | undefined) ?? undefined,
  };
}

function normalizeRedfin(r: Record<string, unknown>): Normalized {
  return {
    address: String(r.streetLine ?? r.address ?? "").trim(),
    city: String(r.city ?? "").trim(),
    state: String(r.stateCode ?? "").trim(),
    zip: String(r.zip ?? "").trim(),
    price: Math.round(Number(r.price ?? 0) * 100) || undefined,
    dom: typeof r.daysOnMarket === "number" ? (r.daysOnMarket as number) : undefined,
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    agentName: r.agentName as string | undefined,
    agentEmail: r.agentEmail as string | undefined,
    agentPhone: r.agentPhone as string | undefined,
    brokerage: r.brokerage as string | undefined,
  };
}

function normalizeRealtor(r: Record<string, unknown>): Normalized {
  const loc = (r.location ?? {}) as Record<string, unknown>;
  const addr = (loc.address ?? {}) as Record<string, unknown>;
  const advertisers = (r.advertisers ?? []) as Record<string, unknown>[];
  const agent = advertisers[0] ?? {};
  return {
    address: String(addr.line ?? "").trim(),
    city: String(addr.city ?? "").trim(),
    state: String(addr.state_code ?? "").trim(),
    zip: String(addr.postal_code ?? "").trim(),
    price: Math.round(Number(r.list_price ?? r.price ?? 0) * 100) || undefined,
    dom: typeof r.days_on_market === "number" ? (r.days_on_market as number) : undefined,
    photos: Array.isArray(r.photos)
      ? (r.photos as { href?: string }[]).map((p) => p.href ?? "").filter(Boolean)
      : [],
    agentName: agent.name as string | undefined,
    agentEmail: agent.email as string | undefined,
    agentPhone: agent.phone as string | undefined,
    brokerage: agent.office_name as string | undefined,
  };
}
