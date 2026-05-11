/**
 * Trace a paid order back to its acquisition source. Joins orders →
 * listings (UTM + referrer captured at first touch) → outreach_events
 * (cold-email path) → messages (any inbound replies). Read-only.
 *
 *   npx tsx --env-file=.env.local scripts/trace-order-attribution.ts <stripePaymentIntentId|customerEmail|orderId>
 */
import { db, listings, orders, outreachEvents, messages } from "@/db";
import { eq, or } from "drizzle-orm";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: scripts/trace-order-attribution.ts <pi_...|email|orderId>");
  process.exit(1);
}

async function main() {
  const isPi = arg.startsWith("pi_");
  const isEmail = arg.includes("@");
  const isUuid = /^[0-9a-f]{8}-/i.test(arg);

  console.log(`\n🔍 Tracing: ${arg}\n`);

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      isPi
        ? eq(orders.stripePaymentIntentId, arg)
        : isEmail
          ? eq(orders.customerEmail, arg)
          : isUuid
            ? eq(orders.id, arg)
            : eq(orders.stripeSessionId, arg),
    )
    .limit(5);

  if (orderRows.length === 0) {
    console.error(`✗ No order found for ${arg}`);
    process.exit(1);
  }

  for (const order of orderRows) {
    console.log(`════════════════════════════════════════════`);
    console.log(`ORDER ${order.id}`);
    console.log(`────────────────────────────────────────────`);
    console.log(`  Status:         ${order.status}`);
    console.log(`  Tier:           ${order.tier}`);
    console.log(`  Amount:         $${(order.amountCents / 100).toFixed(2)}`);
    console.log(`  Customer email: ${order.customerEmail ?? "(none)"}`);
    console.log(`  Stripe PI:      ${order.stripePaymentIntentId ?? "(none)"}`);
    console.log(`  Created:        ${order.createdAt.toISOString()}`);
    console.log(`  Paid:           ${order.paidAt?.toISOString() ?? "(unpaid)"}`);
    console.log(`  Fulfilled:      ${order.fulfilledAt?.toISOString() ?? "(pending)"}`);

    // ─── Listing + attribution ─────────────────────────────────────────
    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, order.listingId))
      .limit(1);

    if (!listing) {
      console.log(`\n  ⚠ Listing ${order.listingId} not found (orphan)`);
      continue;
    }

    console.log(`\nLISTING ${listing.id}`);
    console.log(`────────────────────────────────────────────`);
    console.log(`  Source:         ${listing.source}`);
    console.log(`  Address:        ${listing.address}`);
    console.log(`  City:           ${listing.city}, ${listing.state}`);
    console.log(`  Listing URL:    ${listing.listingUrl ?? "(none)"}`);
    console.log(`  Title:          ${listing.scrapedTitle ?? "(none)"}`);
    console.log(`  Host name:      ${listing.agentName ?? "(none)"}`);
    console.log(`  Host email:     ${listing.agentEmail ?? "(not enriched)"}`);
    console.log(`  Listing seen:   ${listing.createdAt.toISOString()}`);

    console.log(`\n📍 ACQUISITION ATTRIBUTION`);
    console.log(`────────────────────────────────────────────`);
    const hasUtm =
      listing.utmSource ||
      listing.utmMedium ||
      listing.utmCampaign ||
      listing.utmContent ||
      listing.referrer;

    if (!hasUtm) {
      console.log(`  ⚠ No UTM/referrer captured.`);
      console.log(`  → Implies: direct traffic, OR cold-discovered listing (not self-serve), OR cookie was blocked.`);
    } else {
      console.log(`  utm_source:     ${listing.utmSource ?? "(none)"}`);
      console.log(`  utm_medium:     ${listing.utmMedium ?? "(none)"}`);
      console.log(`  utm_campaign:   ${listing.utmCampaign ?? "(none)"}`);
      console.log(`  utm_term:       ${listing.utmTerm ?? "(none)"}`);
      console.log(`  utm_content:    ${listing.utmContent ?? "(none)"}`);
      console.log(`  referrer:       ${listing.referrer ?? "(none)"}`);

      // Interpret
      const verdict = interpretAttribution(listing);
      console.log(`\n  → VERDICT: ${verdict}`);
    }

    // ─── Cold outreach trail ────────────────────────────────────────────
    const outreach = await db
      .select()
      .from(outreachEvents)
      .where(eq(outreachEvents.listingId, listing.id));

    if (outreach.length > 0) {
      console.log(`\n📧 COLD-OUTREACH HISTORY`);
      console.log(`────────────────────────────────────────────`);
      for (const e of outreach) {
        console.log(`  ${e.channel} · ${e.status} · template=${e.templateId}`);
        console.log(`    Sent:    ${e.sentAt?.toISOString() ?? "(not sent)"}`);
        console.log(`    Opened:  ${e.firstOpenedAt?.toISOString() ?? "(never)"}`);
        console.log(`    Clicked: ${e.firstClickedAt?.toISOString() ?? "(never)"}`);
        console.log(`    Replied: ${e.repliedAt?.toISOString() ?? "(never)"}`);
        if (e.subject) console.log(`    Subject: ${e.subject}`);
      }
    }

    // ─── Inbound messages (replies) ────────────────────────────────────
    const inbound = await db
      .select()
      .from(messages)
      .where(or(eq(messages.listingId, listing.id), eq(messages.orderId, order.id)));

    if (inbound.length > 0) {
      console.log(`\n💬 MESSAGES`);
      console.log(`────────────────────────────────────────────`);
      for (const m of inbound) {
        console.log(`  ${m.direction.padEnd(8)} ${m.createdAt.toISOString()}`);
        console.log(`    From:    ${m.from}`);
        console.log(`    Subject: ${m.subject ?? "(none)"}`);
        if (m.classification) console.log(`    Class:   ${m.classification}`);
      }
    }

    // ─── Final summary ─────────────────────────────────────────────────
    console.log(`\n🎯 FINAL ATTRIBUTION`);
    console.log(`────────────────────────────────────────────`);
    if (outreach.length > 0 && outreach.some((e) => e.sentAt)) {
      console.log(`  COLD EMAIL — we found this listing, sent outreach, they paid.`);
      console.log(`  Outreach send: ${outreach[0].sentAt?.toISOString()}`);
    } else if (listing.utmSource === "partner") {
      console.log(`  PARTNER REFERRAL — utm_content="${listing.utmContent}" sent them in.`);
    } else if (listing.utmSource === "meta") {
      console.log(`  META AD — campaign=${listing.utmCampaign}, content=${listing.utmContent}`);
    } else if (listing.utmSource === "google") {
      console.log(`  GOOGLE ADS — campaign=${listing.utmCampaign}, content=${listing.utmContent}`);
    } else if (listing.utmSource === "reddit") {
      console.log(`  REDDIT — campaign=${listing.utmCampaign}, content=${listing.utmContent}`);
    } else if (listing.referrer) {
      console.log(`  ORGANIC REFERRAL from ${listing.referrer}`);
    } else if (listing.source === "self_serve") {
      console.log(`  DIRECT TRAFFIC (self-served, no UTM, no referrer)`);
      console.log(`  → They typed restay.agency or knew the brand.`);
    } else {
      console.log(`  COLD-DISCOVERED listing that paid through some non-self-serve path.`);
    }
  }
  console.log(`\n════════════════════════════════════════════\n`);
}

function interpretAttribution(l: typeof listings.$inferSelect): string {
  const src = l.utmSource;
  const med = l.utmMedium;
  const cmp = l.utmCampaign;
  const cnt = l.utmContent;
  if (src === "partner") return `Partner referral from "${cnt}" (30% commission owed)`;
  if (src === "meta") return `Meta ad — variant "${cnt}", campaign "${cmp}"`;
  if (src === "google" && med === "cpc") return `Google branded-defense ad`;
  if (src === "google" && cmp?.startsWith("category")) return `Google category Search ad`;
  if (src === "reddit") return `Reddit ad — "${cnt}"`;
  if (src === "youtube") return `YouTube preroll — placement "${cnt}"`;
  if (src === "tfv") return `Thanks For Visiting podcast sponsor`;
  if (src === "str_unfiltered") return `STR Unfiltered podcast sponsor`;
  if (src === "gp4yp") return `Get Paid For Your Pad podcast sponsor`;
  if (l.referrer?.includes("reddit.com")) return `Reddit organic post`;
  if (l.referrer?.includes("youtube.com")) return `YouTube organic`;
  if (l.referrer?.includes("twitter.com") || l.referrer?.includes("x.com")) return `Twitter/X organic`;
  if (l.referrer?.includes("facebook.com")) return `Facebook organic`;
  if (l.referrer?.includes("google.com")) return `Google organic search`;
  if (l.referrer) return `Referral from ${new URL(l.referrer).hostname}`;
  return `Direct (no UTM, no referrer)`;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗", err);
    process.exit(1);
  });

export {};
