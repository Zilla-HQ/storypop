import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import { scoreListingPhotos } from "@/lib/vision";
import { scoreAgentValue, computeTargetScore, isQualified } from "@/lib/scoring";
import { trackEvent } from "@/lib/posthog";
import { findContractorContact } from "@/lib/find-contractor-email";
import { skiptrace } from "@/lib/skiptrace";

export const qualificationFn = inngest.createFunction(
  {
    id: "qualification",
    name: "Agent 2 — Qualification",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "listings/ingested" },
  async ({ event, step, logger }) => {
    const { listingId } = event.data;

    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.qualificationPaused) {
      return { skipped: true, reason: "paused" };
    }

    const listing = await step.run("load-listing", async () => {
      const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      return row;
    });
    if (!listing) return { skipped: true, reason: "listing not found" };

    // Email discovery — Zillow stopped exposing agent emails publicly. Try to
    // find one before qualifying (otherwise outreach has nowhere to send).
    // Skip for self-serve / homeowner sources where the email is already set
    // (self-serve = customer's own email; homeowner cold = skiptraced upstream).
    const needsEmailDiscovery =
      !listing.agentEmail &&
      listing.source !== "homeowner_self_serve" &&
      !(listing.qualificationReason ?? "").startsWith("self-serve") &&
      listing.agentName;

    if (needsEmailDiscovery) {
      const email = await step.run("discover-agent-email", async () => {
        // Tier 1: Google search "<agent name> <brokerage> <city> <state>"
        // and scrape the result for an email. find-contractor-email is the
        // generic "given an entity, find their email" helper.
        const searchEntity = listing.brokerage
          ? `${listing.agentName} ${listing.brokerage}`
          : (listing.agentName as string);
        const contact = await findContractorContact({
          name: searchEntity,
          city: listing.city,
          state: listing.state,
          yelpUrl: null,
        });
        if (contact.email) return contact.email;

        // Tier 2: skiptrace via Apollo / Hunter
        const trace = await skiptrace({
          firstName: null,
          lastName: null,
          fullName: listing.agentName,
          city: listing.city,
          state: listing.state,
          zip: listing.zip,
        });
        return trace.email;
      });

      if (email) {
        await step.run("set-discovered-email", async () => {
          await db
            .update(listings)
            .set({ agentEmail: email })
            .where(eq(listings.id, listingId));
        });
        listing.agentEmail = email;
        logger.info(`Discovered email for ${listing.agentName}: ${email}`);
      }
    }

    // Blacklist check
    if (
      (listing.agentEmail && settings.emailBlacklist.includes(listing.agentEmail.toLowerCase())) ||
      (listing.brokerage && settings.brokerageBlacklist.includes(listing.brokerage.toLowerCase()))
    ) {
      await step.run("mark-blacklisted", async () => {
        await db
          .update(listings)
          .set({ qualified: false, qualificationReason: "blacklist" })
          .where(eq(listings.id, listingId));
      });
      return { skipped: true, reason: "blacklist" };
    }

    const photoScore = await step.run("score-photos", async () => {
      if (!listing.photos || listing.photos.length === 0) {
        return { avgScore: 5, perPhoto: [] }; // skip — no photos means we can't enhance
      }
      return scoreListingPhotos(listing.photos);
    });

    const agentScore = await step.run("score-agent", () => scoreAgentValue(listing));

    const target = await step.run("compute-target-score", () =>
      computeTargetScore({
        photoScore: photoScore.avgScore,
        agentValueScore: agentScore.score,
        priceCents: listing.price,
      }),
    );

    const qualification = isQualified({
      photoScore: photoScore.avgScore,
      agentValueScore: agentScore.score,
      priceCents: listing.price,
    });

    await step.run("mark-qualified", async () => {
      await db
        .update(listings)
        .set({
          photoScore: photoScore.avgScore,
          agentValueScore: agentScore.score,
          targetScore: target,
          qualified: qualification.qualified,
          qualificationReason: qualification.reason,
        })
        .where(eq(listings.id, listingId));
    });

    await trackEvent({
      distinctId: listingId,
      event: "listing_qualified",
      properties: {
        qualified: qualification.qualified,
        reason: qualification.reason,
        photo_score: photoScore.avgScore,
        agent_value_score: agentScore.score,
        target_score: target,
      },
    });

    if (qualification.qualified) {
      await step.sendEvent("emit-qualified", {
        name: "listings/qualified",
        data: { listingId },
      });
    }

    logger.info(
      `Qualification for ${listingId}: qualified=${qualification.qualified} (${qualification.reason})`,
    );

    return { qualified: qualification.qualified, target };
  },
);
