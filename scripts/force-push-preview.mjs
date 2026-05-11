/**
 * Force-push the 360 S Anita Ave listing (or most-recent-with-photos) through
 * preview → outreach by emitting `listings/qualified` directly. Bypasses the
 * photo-score gate for the demo.
 */
import postgres from "postgres";
import { Inngest } from "inngest";

const db = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 15 });
const inngest = new Inngest({ id: "force-push", eventKey: process.env.INNGEST_EVENT_KEY });

const [listing] = await db`
  SELECT id, slug, address FROM relist.listings
  WHERE jsonb_array_length(photos::jsonb) > 0
  ORDER BY created_at DESC LIMIT 1
`;
if (!listing) { console.error("No listing with photos"); process.exit(1); }
console.log(`Using: ${listing.address} (${listing.id})`);
console.log(`Slug : /l/${listing.slug}`);

await db`
  UPDATE relist.listings
  SET qualified = true, qualification_reason = 'force-push for demo'
  WHERE id = ${listing.id}
`;
console.log("Marked qualified=true");

const r = await inngest.send({
  name: "listings/qualified",
  data: { listingId: listing.id },
});
console.log(`Fired listings/qualified: ${JSON.stringify(r.ids)}`);
console.log(`\nExpect: preview (~30s fal.ai x2) → outreach (~10s) → email to jack@seifdn.org`);
console.log(`The email's CTA will point to https://realscale.app/l/${listing.slug}`);

await db.end();
