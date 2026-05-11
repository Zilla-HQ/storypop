/**
 * What was actually generated and delivered for an order.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-order-deliverables.ts <pi_...|orderId>
 *
 * Joins orders → previews → pricing_reports → rewritten_copies →
 * outreach_events (delivery email) → messages. Read-only.
 */
import { db, listings, orders, previews, pricingReports, rewrittenCopies, outreachEvents, messages } from "@/db";
import { eq, or } from "drizzle-orm";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: scripts/inspect-order-deliverables.ts <pi_...|orderId>");
  process.exit(1);
}

async function main() {
  const isPi = arg.startsWith("pi_");
  const isUuid = /^[0-9a-f]{8}-/i.test(arg);

  const [order] = await db
    .select()
    .from(orders)
    .where(isPi ? eq(orders.stripePaymentIntentId, arg) : isUuid ? eq(orders.id, arg) : eq(orders.stripeSessionId, arg))
    .limit(1);

  if (!order) {
    console.error(`✗ No order for ${arg}`);
    process.exit(1);
  }

  const listingId = order.listingId;
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);

  console.log(`\n══════════════════════════════════════════`);
  console.log(`ORDER ${order.id}`);
  console.log(`──────────────────────────────────────────`);
  console.log(`  Tier:           ${order.tier}`);
  console.log(`  Amount paid:    $${(order.amountCents / 100).toFixed(2)}`);
  console.log(`  Status:         ${order.status}`);
  console.log(`  Created:        ${order.createdAt.toISOString()}`);
  console.log(`  Paid:           ${order.paidAt?.toISOString() ?? "(unpaid)"}`);
  console.log(`  Fulfilled:      ${order.fulfilledAt?.toISOString() ?? "(NEVER)"}`);
  console.log(`  Fulfillment job: ${order.fulfillmentJobId ?? "(NEVER STARTED)"}`);
  console.log(`  Delivery URL:   ${order.deliveryUrl ?? "(none)"}`);
  console.log(`  Zip URL:        ${order.zipUrl ?? "(none)"}`);

  // What was scoped to be delivered for this tier:
  console.log(`\n══════════════════════════════════════════`);
  console.log(`SCOPED DELIVERABLES (for tier="${order.tier}")`);
  console.log(`──────────────────────────────────────────`);
  if (order.tier === "standard") {
    console.log(`  · Rewritten title + description`);
    console.log(`  · 10 restyled photos (declutter, relight, color, sky)`);
    console.log(`  · 30-day pricing report based on ~50 nearby comps`);
    console.log(`  · ZIP delivery email`);
    console.log(`  · SLA: < 4 hours after Stripe payment`);
  } else if (order.tier === "premium") {
    console.log(`  · Rewritten title + A/B alt title + description`);
    console.log(`  · 20 restyled photos`);
    console.log(`  · Seasonal pricing calendar`);
    console.log(`  · ZIP delivery email`);
  } else if (order.tier === "rush") {
    console.log(`  · Same as standard, 24-hour SLA priority queue`);
  }

  // ─── What actually got generated ────────────────────────────────────
  console.log(`\n══════════════════════════════════════════`);
  console.log(`ACTUALLY GENERATED`);
  console.log(`──────────────────────────────────────────`);

  // 1. Previews (preview/sample image generation — fires before payment)
  const allPreviews = await db.select().from(previews).where(eq(previews.listingId, listingId));
  if (allPreviews.length === 0) {
    console.log(`  Previews:           ✗ NONE`);
  } else {
    console.log(`  Previews:           ${allPreviews.length}`);
    for (const p of allPreviews) {
      console.log(`    · ${p.id}`);
      console.log(`      Service:        ${p.serviceId}`);
      console.log(`      Style preset:   ${p.stylePreset}`);
      console.log(`      Originals:      ${p.originalPhotoUrls.length} photo(s)`);
      console.log(`      Enhanced:       ${p.enhancedPhotoUrls.length} photo(s)`);
      console.log(`      Cost:           $${(p.costCents / 100).toFixed(2)}`);
      console.log(`      Created:        ${p.createdAt.toISOString()}`);
      if (p.enhancedPhotoUrls[0]) {
        console.log(`      Sample after:   ${p.enhancedPhotoUrls[0].slice(0, 90)}...`);
      }
    }
  }

  // 2. Pricing reports (created during fulfillment)
  const reports = await db
    .select()
    .from(pricingReports)
    .where(eq(pricingReports.listingId, listingId));
  if (reports.length === 0) {
    console.log(`\n  Pricing report:     ✗ NONE`);
  } else {
    console.log(`\n  Pricing reports:    ${reports.length}`);
    for (const r of reports) {
      console.log(`    · Comps used:     ${r.compSampleSize} listings`);
      console.log(`      Host nightly:   $${(r.hostNightlyCents / 100).toFixed(0)}`);
      console.log(`      Comp median:    $${(r.compMedianNightlyCents / 100).toFixed(0)}`);
      console.log(`      Recommend wkdy: $${(r.recommendedWeekdayCents / 100).toFixed(0)}`);
      console.log(`      Recommend wknd: $${(r.recommendedWeekendCents / 100).toFixed(0)}`);
      console.log(`      Created:        ${r.createdAt.toISOString()}`);
    }
  }

  // 3. Rewritten copy (created during fulfillment)
  const copies = await db
    .select()
    .from(rewrittenCopies)
    .where(eq(rewrittenCopies.listingId, listingId));
  if (copies.length === 0) {
    console.log(`\n  Rewritten copy:     ✗ NONE`);
  } else {
    console.log(`\n  Rewritten copy:     ${copies.length}`);
    for (const c of copies) {
      console.log(`    · Original title:  "${c.originalTitle?.slice(0, 60) ?? "(none)"}"`);
      console.log(`      New title:       "${c.rewrittenTitle.slice(0, 60)}"`);
      if (c.altTitle) console.log(`      Alt title:       "${c.altTitle.slice(0, 60)}"`);
      console.log(`      New desc len:    ${c.rewrittenDescription.length} chars`);
      console.log(`      Created:        ${c.createdAt.toISOString()}`);
    }
  }

  // 4. Delivery email (transactional outreach for the paid customer)
  const sentEmails = await db
    .select()
    .from(outreachEvents)
    .where(eq(outreachEvents.listingId, listingId));
  console.log(`\n  Outreach events:    ${sentEmails.length}`);
  for (const e of sentEmails) {
    console.log(`    · template=${e.templateId} channel=${e.channel} status=${e.status}`);
    if (e.subject) console.log(`      Subject:         "${e.subject.slice(0, 80)}"`);
    console.log(`      Sent:            ${e.sentAt?.toISOString() ?? "(never)"}`);
    console.log(`      Opened:          ${e.firstOpenedAt?.toISOString() ?? "(never)"}`);
  }

  // 5. Inbound messages (any reply, complaint, etc.)
  const msgs = await db
    .select()
    .from(messages)
    .where(or(eq(messages.listingId, listingId), eq(messages.orderId, order.id)));
  if (msgs.length > 0) {
    console.log(`\n  Inbound messages:   ${msgs.length}`);
    for (const m of msgs) {
      console.log(`    · ${m.direction.padEnd(8)} ${m.createdAt.toISOString()}`);
      console.log(`      From:            ${m.from}`);
      console.log(`      Subject:         ${m.subject ?? "(none)"}`);
      if (m.classification) console.log(`      Classification:  ${m.classification}`);
    }
  } else {
    console.log(`\n  Inbound messages:   (none)`);
  }

  // ─── Verdict ───────────────────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════`);
  console.log(`VERDICT`);
  console.log(`──────────────────────────────────────────`);
  const hasPreview = allPreviews.length > 0;
  const hasFullDeliverables = reports.length > 0 && copies.length > 0;
  const fulfillmentStarted = !!order.fulfillmentJobId;
  const fulfillmentCompleted = !!order.fulfilledAt;

  if (fulfillmentCompleted) {
    console.log(`  ✓ Fulfillment completed.`);
    console.log(`  → Customer received the full Tune-Up before refunding.`);
    console.log(`    Investigate quality issues, not delivery issues.`);
  } else if (hasFullDeliverables) {
    console.log(`  ⚠ Deliverables generated but fulfilledAt is null.`);
    console.log(`  → DB may be inconsistent; or job crashed mid-delivery.`);
  } else if (fulfillmentStarted) {
    console.log(`  ⚠ Fulfillment job started (${order.fulfillmentJobId}) but never finished.`);
    console.log(`  → Customer paid, refunded before fulfillment completed.`);
  } else if (hasPreview) {
    console.log(`  ✗ Only the pre-payment preview was generated.`);
    console.log(`  → Customer saw the free preview, paid, refunded before fulfillment kicked off.`);
    console.log(`  → They received NOTHING beyond the preview they saw before paying.`);
  } else {
    console.log(`  ✗ Nothing was generated for this listing.`);
    console.log(`  → Customer paid + refunded with no preview, no deliverables.`);
  }

  console.log(`\n──────────────────────────────────────────\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗", err);
    process.exit(1);
  });

export {};
