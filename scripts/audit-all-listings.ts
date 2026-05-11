import { db, listings, orders } from "@/db";
import { sql, desc } from "drizzle-orm";

async function main() {
  const all = await db
    .select({
      id: listings.id,
      source: listings.source,
      city: listings.city,
      title: listings.scrapedTitle,
      agentEmail: listings.agentEmail,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .orderBy(desc(listings.createdAt))
    .limit(30);
  console.log(`Total listings (most recent ${all.length}):`);
  for (const l of all) {
    const c = (l.createdAt as unknown as string | Date);
    const t = typeof c === "string" ? c : c.toISOString();
    console.log(`  ${l.id.slice(0, 8)}  src=${l.source.padEnd(10)} city=${(l.city ?? "?").slice(0, 18).padEnd(18)} email=${(l.agentEmail ?? "-").slice(0, 30).padEnd(30)} ${t}`);
  }

  const [tot] = await db.select({ c: sql<number>`count(*)::int` }).from(listings);
  console.log(`\nTotal listings in DB: ${tot.c}`);

  const [oTot] = await db.select({ c: sql<number>`count(*)::int` }).from(orders);
  console.log(`Total orders in DB:   ${oTot.c}`);

  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  console.log(`\nAll orders (${allOrders.length}):`);
  for (const o of allOrders) {
    console.log(`  ${o.id.slice(0, 8)}  status=${o.status.padEnd(10)} tier=${o.tier} amt=$${(o.amountCents / 100).toFixed(2)} listing=${o.listingId.slice(0, 8)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
