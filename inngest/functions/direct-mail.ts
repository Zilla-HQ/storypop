import { inngest } from "@/inngest/client";
import { db, listings, directMailEvents } from "@/db";
import { and, eq, gte, isNotNull, ne, notInArray, sql } from "drizzle-orm";
import { getSettings } from "@/db/settings";
import {
  sendPostcard,
  renderPostcardFront,
  renderPostcardBack,
  readFromAddressEnv,
} from "@/lib/lob-postcards";

/**
 * Direct-mail postcard cron via Lob.
 *
 * Weekday afternoons (17:00 UTC ≈ 1pm ET — before Lob's same-business-
 * day cutoff). Sends 4x6 postcards to qualified listings that:
 *   - have a generated preview URL (or product URL)
 *   - have a full US address
 *   - have NOT been mailed before
 *
 * Budget-capped per run AND per day. The cron no-ops silently when
 * LOB_API_KEY or the LOB_FROM_* return-address envs are missing.
 *
 * Customize:
 *   POSTCARD_BRAND_NAME  — overlay brand on the front
 *   POSTCARD_CTA_TITLE   — back-side headline
 *   POSTCARD_CTA_BODY    — back-side message
 *   POSTCARD_PRICE_LABEL — pill at the bottom (optional)
 */
export const directMailFn = inngest.createFunction(
  {
    id: "direct-mail",
    name: "Direct mail — Lob postcards",
    retries: 1,
  },
  // Weekdays 17:00 UTC, plus manual trigger.
  [{ cron: "0 17 * * 1-5" }, { event: "direct-mail/run" }],
  async ({ step, logger }) => {
    const settings = await step.run("settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    const fromAddress = readFromAddressEnv();
    if (!fromAddress) {
      return { skipped: true, reason: "LOB_FROM_* envs missing" };
    }
    if (!process.env.LOB_API_KEY) {
      return { skipped: true, reason: "LOB_API_KEY missing" };
    }

    const perRunCap = Number(process.env.DIRECT_MAIL_PER_RUN_CAP ?? "20");
    const dailyBudgetCents = Number(
      process.env.DIRECT_MAIL_DAILY_BUDGET_CENTS ?? "5000",
    );
    const assumedPieceCostCents = Number(
      process.env.DIRECT_MAIL_ASSUMED_COST_CENTS ?? "100",
    );

    // Today's spend so far
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [spentRow] = await db
      .select({
        spent: sql<number>`coalesce(sum(${directMailEvents.costCents}), 0)::int`,
      })
      .from(directMailEvents)
      .where(gte(directMailEvents.createdAt, todayStart));
    const spentCentsToday = Number(spentRow?.spent ?? 0);

    if (spentCentsToday >= dailyBudgetCents) {
      return { skipped: true, reason: "daily budget exhausted", spentCentsToday };
    }

    const remainingBudget = dailyBudgetCents - spentCentsToday;
    const affordable = Math.floor(remainingBudget / assumedPieceCostCents);
    const thisRunBudget = Math.min(perRunCap, affordable);
    if (thisRunBudget <= 0) {
      return { skipped: true, reason: "per-run budget 0", spentCentsToday };
    }

    // Listings already mailed — to exclude
    const mailedRows = await db
      .select({ listingId: directMailEvents.listingId })
      .from(directMailEvents);
    const alreadyMailed = Array.from(new Set(mailedRows.map((r) => r.listingId)));

    const baseWhere = [
      eq(listings.qualified, true),
      isNotNull(listings.address),
      ne(listings.address, ""),
      isNotNull(listings.city),
      ne(listings.city, ""),
      isNotNull(listings.state),
      ne(listings.state, ""),
      isNotNull(listings.zip),
      ne(listings.zip, ""),
    ];
    const whereClause = alreadyMailed.length
      ? and(...baseWhere, notInArray(listings.id, alreadyMailed))
      : and(...baseWhere);

    const eligible = await db.select().from(listings).where(whereClause).limit(thisRunBudget);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    const brandName = process.env.POSTCARD_BRAND_NAME ?? process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";
    const ctaTitle = process.env.POSTCARD_CTA_TITLE ?? "We made something for you.";
    const ctaBody =
      process.env.POSTCARD_CTA_BODY ??
      "Pulled from your real Google photos, hours, and reviews. Ready in 24 hours. Mobile-first. No subscription.";
    const priceLabel = process.env.POSTCARD_PRICE_LABEL;

    let sent = 0;
    let failed = 0;
    let runSpentCents = 0;

    for (const listing of eligible) {
      if (runSpentCents + spentCentsToday >= dailyBudgetCents) break;

      const heroPhotoUrl = listing.photos[0] ?? null;
      const previewUrl = `${appUrl}/l/${listing.slug}`;
      const cityLabel = `${listing.city}${listing.state ? `, ${listing.state}` : ""}`;

      const frontHtml = renderPostcardFront({
        brandName,
        cityLabel,
        heroPhotoUrl,
        headline: listing.agentName ? `For ${listing.agentName.split(" ")[0]}` : undefined,
      });
      const backHtml = renderPostcardBack({
        brandName,
        ctaTitle,
        ctaBody,
        previewUrl,
        priceLabel,
      });

      const result = await sendPostcard({
        description: `${brandName} pitch — listing ${listing.id}`,
        to: {
          name: (listing.agentName ?? listing.address).slice(0, 40),
          addressLine1: listing.address,
          addressCity: listing.city,
          addressState: listing.state,
          addressZip: listing.zip,
          addressCountry: "US",
        },
        from: fromAddress,
        frontHtml,
        backHtml,
        size: "4x6",
        metadata: { listingId: listing.id, slug: listing.slug },
      });

      if (result.success) {
        runSpentCents += result.costCents ?? assumedPieceCostCents;
        sent += 1;
        await db.insert(directMailEvents).values({
          listingId: listing.id,
          provider: "lob",
          providerId: result.lobId,
          status: "sent",
          costCents: result.costCents ?? null,
          metadata: {
            previewUrl,
            expectedDeliveryDate: result.expectedDeliveryDate ?? null,
          },
          sentAt: new Date(),
        });
      } else {
        failed += 1;
        logger.warn(`direct-mail listing ${listing.id} failed: ${result.error}`);
        await db.insert(directMailEvents).values({
          listingId: listing.id,
          provider: "lob",
          status: "failed",
          metadata: { error: result.error?.slice(0, 500) ?? "unknown" },
        });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    return {
      eligible: eligible.length,
      sent,
      failed,
      spentCentsToday: spentCentsToday + runSpentCents,
      dailyBudgetCents,
    };
  },
);
