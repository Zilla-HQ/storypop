/**
 * Smoke-test the full pipeline end-to-end.
 * Seeds a listing with the admin's email so the outreach email comes
 * back to a real inbox, then fires listings/ingested.
 */
import postgres from "postgres";
import { Inngest } from "inngest";

const db = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 15 });
const inngest = new Inngest({
  id: "relist-smoke-test",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const TEST_EMAIL = process.argv[2] ?? "jack@seifdn.org";
const sourceId = `smoke-${Date.now()}`;
const slug = `smoke-test-${Date.now().toString(36)}`;

const [row] = await db`
  INSERT INTO relist.listings
    (source, source_id, address, city, state, zip, price, dom,
     listing_type, photos, agent_name, agent_email, agent_phone,
     brokerage, slug)
  VALUES
    ('zillow', ${sourceId}, '1234 Sample Ave', 'Austin', 'TX', '78701',
     68500000, 4, 'single_family',
     ${db.json([
       "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80",
       "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
       "https://images.unsplash.com/photo-1617104551722-3b2d51366400?auto=format&fit=crop&w=1200&q=80",
     ])},
     'Test Agent', ${TEST_EMAIL}, '+15125550123', 'Seed Realty', ${slug})
  RETURNING id`;
console.log(`Seeded listing: ${row.id}`);
console.log(`Personalized URL: https://realscale.app/l/${slug}`);
console.log(`Outreach target email: ${TEST_EMAIL}`);

const evt = await inngest.send({
  name: "listings/ingested",
  data: { listingId: row.id, source: "zillow" },
});
console.log(`\nFired listings/ingested — Inngest IDs: ${JSON.stringify(evt.ids)}`);
console.log("\nExpected pipeline sequence:");
console.log("  1. Qualification  (~10s  vision + heuristics)");
console.log("  2. Preview        (~30s  fal.ai x2 + R2 uploads)");
console.log("  3. Outreach       (~10s  Claude draft + Resend send)");
console.log("\nWatch inbox + https://app.inngest.com runs.");

await db.end();
