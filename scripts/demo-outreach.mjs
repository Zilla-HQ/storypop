/**
 * Demo: seed a realistic Brentwood LA listing with the user's email as
 * the "agent", then walk the full pipeline (qualification → preview →
 * outreach) by firing listings/ingested and polling the DB for state.
 */
import postgres from "postgres";
import { Inngest } from "inngest";

const db = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 15 });
const inngest = new Inngest({ id: "relist-demo", eventKey: process.env.INNGEST_EVENT_KEY });

const sourceId = `zillow-20538043-${Date.now()}`;
const slug = `360-s-anita-ave-${Date.now().toString(36)}`;

// Photos: Unsplash stock that looks plausible for a Brentwood home.
const photos = [
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80", // modern LA exterior
  "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1600&q=80", // living room
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80", // kitchen
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80", // bedroom
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80", // bathroom
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80", // dining
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80", // pool/backyard
  "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?auto=format&fit=crop&w=1600&q=80", // office
];

const [row] = await db`
  INSERT INTO relist.listings
    (source, source_id, address, city, state, zip, price, dom,
     listing_type, photos, agent_name, agent_email, agent_phone,
     brokerage, slug)
  VALUES
    ('zillow', ${sourceId}, '360 S Anita Ave', 'Los Angeles', 'CA', '90049',
     450000000, 6, 'single_family',
     ${db.json(photos)},
     'Jack Lipstone', 'jack@seifdn.org', '+13105550123',
     'Brentwood Estates', ${slug})
  RETURNING id`;

console.log(`\n✓ Seeded listing ${row.id}`);
console.log(`  Address:        360 S Anita Ave, Los Angeles, CA 90049`);
console.log(`  Price:          $4,500,000`);
console.log(`  Photos:         ${photos.length}`);
console.log(`  Agent email:    jack@seifdn.org`);
console.log(`  Personalized:   https://realscale.app/l/${slug}`);

const evt = await inngest.send({
  name: "listings/ingested",
  data: { listingId: row.id, source: "zillow" },
});
console.log(`\n✓ Fired listings/ingested ${JSON.stringify(evt.ids)}`);
console.log("\nWalking pipeline — qualification → preview → outreach");

// Poll for ~5 minutes, printing state transitions
const start = Date.now();
let lastSnap = "";
while (Date.now() - start < 5 * 60_000) {
  const [snap] = await db`
    SELECT
      (SELECT qualification_reason FROM relist.listings WHERE id = ${row.id}) AS qual,
      (SELECT count(*)::int FROM relist.previews WHERE listing_id = ${row.id}) AS prev,
      (SELECT count(*)::int FROM relist.outreach_events WHERE listing_id = ${row.id}) AS outr,
      (SELECT status::text FROM relist.outreach_events WHERE listing_id = ${row.id}
       ORDER BY created_at DESC LIMIT 1) AS last_status,
      (SELECT subject FROM relist.outreach_events WHERE listing_id = ${row.id}
       ORDER BY created_at DESC LIMIT 1) AS subject
  `;
  const t = `${Math.round((Date.now() - start) / 1000)}s`;
  const line = `[+${t.padStart(4)}] qual=${snap.qual ?? "–"} previews=${snap.prev} outreach=${snap.outr} status=${snap.last_status ?? "–"}`;
  if (line !== lastSnap) {
    console.log(line);
    lastSnap = line;
  }
  if (snap.last_status && ["sent", "delivered", "failed"].includes(snap.last_status)) {
    console.log(`\n✓ Terminal state: ${snap.last_status}`);
    console.log(`  Subject: "${snap.subject ?? ""}"`);
    break;
  }
  await new Promise((r) => setTimeout(r, 5000));
}

await db.end();
