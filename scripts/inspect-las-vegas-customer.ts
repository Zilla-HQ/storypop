import { db, listings, orders, previews } from "@/db";
import { eq, desc } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function main() {
  // The order I marked failed earlier
  const orderId = "9fe83da5-b1e7-4e9e-9b8f-c54864103dbd";
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    console.error("not found");
    process.exit(1);
  }

  const [listing] = await db.select().from(listings).where(eq(listings.id, order.listingId)).limit(1);
  const [preview] = await db.select().from(previews).where(eq(previews.listingId, order.listingId)).orderBy(desc(previews.createdAt)).limit(1);

  console.log(`══════ FULL CUSTOMER PICTURE ══════\n`);
  console.log(`LISTING THEY PASTED:`);
  console.log(`  ID:              ${listing?.id}`);
  console.log(`  Title:           ${listing?.scrapedTitle}`);
  console.log(`  Location:        ${listing?.city}, ${listing?.state}`);
  console.log(`  Address:         ${listing?.address}`);
  console.log(`  Airbnb URL:      ${listing?.listingUrl}`);
  console.log(`  Photos count:    ${listing?.photos?.length}`);
  console.log(`  Bedrooms:        ${listing?.bedrooms}`);
  console.log(`  Reviews:         ${listing?.reviewCount}`);
  console.log(`  Avg rating:      ${listing?.avgRating}`);
  console.log(`  Superhost:       ${listing?.isSuperhost}`);
  console.log(`  Listed seen:     ${listing?.createdAt}`);
  console.log(`  Description:     ${(listing?.scrapedDescription ?? "").slice(0, 250)}...`);

  console.log(`\nACQUISITION ATTRIBUTION:`);
  console.log(`  utm_source:      ${listing?.utmSource}`);
  console.log(`  utm_medium:      ${listing?.utmMedium}`);
  console.log(`  utm_campaign:    ${listing?.utmCampaign}`);
  console.log(`  utm_content:     ${listing?.utmContent}`);
  console.log(`  utm_term (Meta ad ID): ${listing?.utmTerm}`);
  console.log(`  referrer:        ${listing?.referrer ?? "(none)"}`);

  console.log(`\nPREVIEW THEY SAW:`);
  if (preview) {
    console.log(`  Created:         ${preview.createdAt}`);
    console.log(`  Originals:       ${preview.originalPhotoUrls.length}`);
    console.log(`  Enhanced:        ${preview.enhancedPhotoUrls.length}`);
    console.log(`  Style preset:    ${preview.stylePreset}`);
    console.log(`  Cost:            $${(preview.costCents / 100).toFixed(2)}`);
    console.log(`  Sample after:    ${preview.enhancedPhotoUrls[0] ?? "(none)"}`);
  } else {
    console.log(`  ✗ NO PREVIEW GENERATED — they may have hit checkout before preview finished`);
  }

  console.log(`\nORDER:`);
  console.log(`  Tier chosen:     ${order.tier} ($${(order.amountCents / 100).toFixed(2)})`);
  console.log(`  Style preset:    ${order.stylePreset}`);
  console.log(`  Status:          ${order.status}`);
  console.log(`  Created:         ${order.createdAt}`);

  console.log(`\nSTRIPE CHECKOUT SESSION:`);
  if (order.stripeSessionId) {
    const sess = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    console.log(`  ID:              ${sess.id}`);
    console.log(`  Status:          ${sess.status}`);
    console.log(`  Payment status:  ${sess.payment_status}`);
    console.log(`  Created:         ${new Date(sess.created * 1000).toISOString()}`);
    console.log(`  Expired:         ${new Date(sess.expires_at * 1000).toISOString()}`);
    console.log(`  Customer email:  ${sess.customer_details?.email ?? sess.customer_email ?? "(NEVER ENTERED)"}`);
    console.log(`  Customer name:   ${sess.customer_details?.name ?? "(NEVER ENTERED)"}`);
    console.log(`  Customer addr:   ${sess.customer_details?.address?.country ?? "(NEVER ENTERED)"}`);
  }

  // Quick funnel timing computation
  if (listing && order) {
    const listingMs = new Date(listing.createdAt as unknown as string).getTime();
    const orderMs = new Date(order.createdAt as unknown as string).getTime();
    const gapMin = Math.round((orderMs - listingMs) / 60_000);
    console.log(`\nFUNNEL TIMING:`);
    console.log(`  URL pasted at:        ${listing.createdAt}`);
    console.log(`  Order created at:     ${order.createdAt}`);
    console.log(`  Time to clicking buy: ${gapMin} minutes`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
