import { db, listings, orders } from "@/db";
import { eq, desc } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function main() {
  // Find pending orders
  const pending = await db
    .select()
    .from(orders)
    .where(eq(orders.status, "pending"))
    .orderBy(desc(orders.createdAt));
  console.log(`Pending orders: ${pending.length}\n`);

  for (const o of pending) {
    const ageMin = Math.round((Date.now() - new Date(o.createdAt as unknown as string).getTime()) / 60_000);
    console.log(`════ Order ${o.id} ════`);
    console.log(`  Tier:           ${o.tier}`);
    console.log(`  Amount:         $${(o.amountCents / 100).toFixed(2)}`);
    console.log(`  Created:        ${o.createdAt}  (${ageMin}m ago)`);
    console.log(`  Stripe session: ${o.stripeSessionId ?? "(none)"}`);

    const [listing] = await db.select().from(listings).where(eq(listings.id, o.listingId)).limit(1);
    if (listing) {
      console.log(`\n  LISTING:`);
      console.log(`    Title:        ${listing.scrapedTitle}`);
      console.log(`    City:         ${listing.city}, ${listing.state}`);
      console.log(`    URL:          ${listing.listingUrl}`);
      console.log(`    UTM source:   ${listing.utmSource ?? "(none)"}`);
      console.log(`    UTM content:  ${listing.utmContent ?? "(none)"}`);
      console.log(`    UTM term:     ${listing.utmTerm ?? "(none)"}`);
    }

    if (o.stripeSessionId) {
      try {
        const sess = await stripe.checkout.sessions.retrieve(o.stripeSessionId);
        console.log(`\n  STRIPE CHECKOUT SESSION:`);
        console.log(`    Status:         ${sess.status}`);
        console.log(`    Payment status: ${sess.payment_status}`);
        console.log(`    Customer email: ${sess.customer_details?.email ?? sess.customer_email ?? "(not yet entered)"}`);
        console.log(`    Customer name:  ${sess.customer_details?.name ?? "(not yet entered)"}`);
        console.log(`    Created:        ${new Date(sess.created * 1000).toISOString()}`);
        console.log(`    Expires:        ${sess.expires_at ? new Date(sess.expires_at * 1000).toISOString() : "(none)"}`);
        console.log(`    URL (re-share): ${sess.url}`);
      } catch (err) {
        console.log(`    Stripe lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
