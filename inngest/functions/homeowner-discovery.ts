import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { eq, and } from "drizzle-orm";
import { discoverHomeownerProperties, type HomeownerService } from "@/lib/homeowner-discovery";
import { skiptrace } from "@/lib/skiptrace";
import { checkOptOut } from "@/lib/state-optout";
import { slugify } from "@/lib/utils";
import { getSettings } from "@/db/settings";
import { trackEvent } from "@/lib/posthog";
import { env } from "@/lib/env";

/**
 * Homeowner cold discovery — the symmetric counterpart to discoveryFn.
 *
 * Twelve-hour cron (offset from the realtor cron so they don't fight for
 * resources). Per service:
 *   1. Pull candidate properties via lib/homeowner-discovery (ATTOM /
 *      PropertyRadar; service-fit filter applied)
 *   2. For each owner, skiptrace name + zip → email (Apollo / Hunter)
 *   3. Run state-level opt-out check before creating any listing
 *   4. Insert a "homeowner cold target" listing with source=attom or
 *      propertyradar, agentEmail = homeowner email
 *   5. Fire listings/qualified so the existing preview pipeline takes
 *      over — preview agent generates the satellite-tile mockup, then
 *      outreach agent sends the homeowner-flavored cold email
 *
 * Env-flag-gated: if ATTOM/PropertyRadar AND skiptrace keys are missing,
 * the cron no-ops. ZIP allow-list comes from HOMEOWNER_DISCOVERY_ZIPS
 * (comma-separated). For each zip, we pull a small batch per service.
 */
export const homeownerDiscoveryFn = inngest.createFunction(
  {
    id: "homeowner-discovery",
    name: "Agent — homeowner cold discovery",
    retries: 1,
    concurrency: { limit: 1 },
  },
  // 12h cron, offset by 3h from the realtor discovery cron (which runs at 0 */6 * * *).
  // Also fires on the admin-manual event so operator can kick a run from /admin.
  [{ cron: "0 3-23/12 * * *" }, { event: "homeowner-discovery/manual" }],
  async ({ step, logger }) => {
    const settings = await getSettings();
    if (settings.paused || settings.discoveryPaused) {
      return { skipped: true, reason: "paused" };
    }

    const zipAllowlist = (env("HOMEOWNER_DISCOVERY_ZIPS") ?? "")
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean);
    if (zipAllowlist.length === 0) {
      logger.info("No HOMEOWNER_DISCOVERY_ZIPS set; skipping homeowner discovery");
      return { skipped: true, reason: "no zip allowlist" };
    }

    const services: HomeownerService[] = ["pool-mockup", "solar-mockup", "curb-appeal"];
    const perServicePerZipLimit = Number(env("HOMEOWNER_DISCOVERY_LIMIT", "10"));

    let totalDiscovered = 0;
    let totalEmailed = 0;
    let totalSkipped = 0;

    for (const zip of zipAllowlist) {
      for (const service of services) {
        const candidates = await step.run(
          `discover-${zip}-${service}`,
          () =>
            discoverHomeownerProperties({
              zip,
              service,
              limit: perServicePerZipLimit,
            }),
        );

        if (candidates.length === 0) continue;
        totalDiscovered += candidates.length;

        for (const c of candidates) {
          // Skiptrace email — best effort
          const trace = await step.run(
            `skiptrace-${c.source}-${c.sourceId}`,
            () =>
              skiptrace({
                firstName: c.ownerFirstName,
                lastName: c.ownerLastName,
                fullName: c.ownerFullName,
                city: c.city,
                state: c.state,
                zip: c.zip,
              }),
          );

          if (!trace.email) {
            totalSkipped += 1;
            continue;
          }

          const opt = await step.run(`optout-${c.source}-${c.sourceId}`, () =>
            checkOptOut({ email: trace.email!, state: c.state }),
          );
          if (!opt.allowed) {
            totalSkipped += 1;
            continue;
          }

          // Insert (or skip if we've already targeted this property)
          const inserted = await step.run(
            `insert-listing-${c.source}-${c.sourceId}`,
            async () => {
              const existing = await db
                .select({ id: listings.id })
                .from(listings)
                .where(
                  and(
                    eq(listings.source, c.source),
                    eq(listings.sourceId, c.sourceId),
                  ),
                )
                .limit(1);
              if (existing.length > 0) return null;

              const slug = slugify(`${c.address} ${c.zip}`);
              const [row] = await db
                .insert(listings)
                .values({
                  source: c.source,
                  sourceId: c.sourceId,
                  address: c.address || "Unknown address",
                  city: c.city,
                  state: c.state,
                  zip: c.zip,
                  price: 0,
                  photos: [],
                  agentName: c.ownerFullName,
                  agentEmail: trace.email,
                  qualified: true,
                  qualificationReason: `homeowner-cold:${service}`,
                  slug: slug ? `${slug}-${c.sourceId.slice(0, 6)}` : c.sourceId,
                })
                .returning();
              return row;
            },
          );

          if (!inserted) {
            // already targeted previously
            continue;
          }

          // Kick the existing preview pipeline. Service id steers it to
          // satellite-tile rendering for pool/solar; exterior_facade
          // rendering for curb-appeal.
          await step.sendEvent(`emit-qualified-${inserted.id}`, {
            name: "listings/qualified",
            data: { listingId: inserted.id, serviceId: service },
          });
          totalEmailed += 1;
        }
      }
    }

    await trackEvent({
      distinctId: "homeowner-discovery",
      event: "homeowner_discovery_completed",
      properties: {
        zips: zipAllowlist.length,
        discovered: totalDiscovered,
        queued: totalEmailed,
        skipped: totalSkipped,
      },
    });

    logger.info(
      `Homeowner discovery — discovered=${totalDiscovered}, queued=${totalEmailed}, skipped=${totalSkipped}`,
    );
    return { discovered: totalDiscovered, queued: totalEmailed, skipped: totalSkipped };
  },
);
