import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { getSettings } from "@/db/settings";
import { fetchZillow, fetchRedfin, fetchRealtor, type ScrapedListing } from "@/lib/apify";
import { slugify } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";
import { sql } from "drizzle-orm";

const PRICE_MIN_CENTS = 15_000_000; // $150k — broadened for aggressive top-of-funnel; outreach gate still requires agent_email

export const discoveryFn = inngest.createFunction(
  {
    id: "discovery",
    name: "Agent 1 — Discovery",
    // 6-hour cron per spec; max 1 Apify call per source per cron tick (no parallelism within a source).
    retries: 3,
  },
  // Cron + manual event trigger so the operator can kick a discovery run
  // from /admin without waiting for the next 6h tick.
  [{ cron: "0 */6 * * *" }, { event: "discovery/manual" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.discoveryPaused) {
      logger.info("Discovery paused via admin settings");
      return { skipped: true };
    }

    const zillow = await step.run("fetch-zillow", async () => {
      try {
        return await fetchZillow(PRICE_MIN_CENTS);
      } catch (err) {
        logger.error("Zillow fetch failed", { err: String(err) });
        return [] as ScrapedListing[];
      }
    });

    const redfin = await step.run("fetch-redfin", async () => {
      try {
        return await fetchRedfin(PRICE_MIN_CENTS);
      } catch (err) {
        logger.error("Redfin fetch failed", { err: String(err) });
        return [] as ScrapedListing[];
      }
    });

    const realtor = await step.run("fetch-realtor", async () => {
      try {
        return await fetchRealtor(PRICE_MIN_CENTS);
      } catch (err) {
        logger.error("Realtor fetch failed", { err: String(err) });
        return [] as ScrapedListing[];
      }
    });

    const all = [...zillow, ...redfin, ...realtor];

    const upserted = await step.run("dedupe-and-upsert", async () => {
      if (all.length === 0) return { inserted: 0, duplicates: 0, ids: [] as string[] };

      // Dedupe within this batch by address+zip
      const seen = new Set<string>();
      const unique = all.filter((l) => {
        const key = `${l.address}|${l.zip}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const ids: string[] = [];
      let inserted = 0;

      for (const l of unique) {
        const baseSlug = slugify(`${l.address} ${l.zip}`);
        const slug = `${baseSlug}-${l.sourceId.slice(-6)}`;

        const result = await db
          .insert(listings)
          .values({
            source: l.source,
            sourceId: l.sourceId,
            mlsId: l.mlsId,
            address: l.address,
            city: l.city,
            state: l.state,
            zip: l.zip,
            price: l.price,
            dom: l.dom,
            listingType: l.listingType ?? "single_family",
            photos: l.photos,
            agentName: l.agentName,
            agentEmail: l.agentEmail,
            agentPhone: l.agentPhone,
            brokerage: l.brokerage,
            slug,
          })
          .onConflictDoUpdate({
            target: [listings.source, listings.sourceId],
            set: {
              lastSeenAt: sql`now()`,
              photos: l.photos,
              price: l.price,
              dom: l.dom ?? null,
            },
          })
          .returning({ id: listings.id, createdAt: listings.createdAt });

        const row = result[0];
        if (!row) continue;
        // Treat as "new" if createdAt is within the last minute — i.e., we just inserted it.
        const isFresh = Date.now() - new Date(row.createdAt).getTime() < 60_000;
        if (isFresh) {
          inserted += 1;
          ids.push(row.id);
        }
      }

      return { inserted, duplicates: unique.length - inserted, ids };
    });

    // Emit an event per new listing so Qualification picks them up individually.
    for (const id of upserted.ids) {
      await step.sendEvent(`emit-ingested-${id}`, {
        name: "listings/ingested",
        data: {
          listingId: id,
          // We don't round-trip the source here — qualification re-reads the row.
          source: "zillow",
        },
      });
    }

    await trackEvent({
      distinctId: "discovery",
      event: "discovery_completed",
      properties: {
        inserted: upserted.inserted,
        duplicates: upserted.duplicates,
        zillow_count: zillow.length,
        redfin_count: redfin.length,
        realtor_count: realtor.length,
      },
    });

    logger.info(`Ingested ${upserted.inserted} new listings, ${upserted.duplicates} duplicates skipped`);

    return upserted;
  },
);
