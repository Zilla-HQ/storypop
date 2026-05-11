/**
 * Re-scrape a listing with the current scraper (post-photo-filter fix)
 * and re-fire the preview pipeline so the customer sees real photos
 * if they revisit /l/<slug>.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-preview.ts <listingId>
 */
import { db, listings, previews } from "@/db";
import { eq } from "drizzle-orm";
import { fetchAirbnbListingDirect } from "@/lib/airbnb-direct";
import { inngest } from "@/inngest/client";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: scripts/regenerate-preview.ts <listingId>");
    process.exit(1);
  }

  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l) {
    console.error(`No listing for id=${id}`);
    process.exit(1);
  }

  console.log(`\n══ ${l.scrapedTitle} ══`);
  console.log(`  Listing URL: ${l.listingUrl}`);
  console.log(`  Old photo count: ${l.photos.length}`);

  // Re-scrape with the fixed extractor
  if (!l.listingUrl) {
    console.error("Listing has no URL");
    process.exit(1);
  }
  const scraped = await fetchAirbnbListingDirect(l.listingUrl);
  if (!scraped) {
    console.error("Re-scrape returned null");
    process.exit(1);
  }
  console.log(`  New photo count: ${scraped.photos.length}`);
  console.log(`  First 3 photos (post-filter):`);
  scraped.photos.slice(0, 3).forEach((p, i) => console.log(`    [${i}] ${p}`));

  const platformLeaks = scraped.photos.filter(
    (p) => p.includes("/AirbnbPlatformAssets/") || p.includes("/AirCover/"),
  );
  if (platformLeaks.length > 0) {
    console.error(`\n✗ ${platformLeaks.length} platform-asset URLs still leaking. Aborting.`);
    process.exit(1);
  }

  // Update the listing's photos array
  await db
    .update(listings)
    .set({
      photos: scraped.photos,
      scrapedTitle: scraped.scrapedTitle ?? l.scrapedTitle,
      scrapedDescription: scraped.scrapedDescription ?? l.scrapedDescription,
      reviewCount: scraped.reviewCount ?? l.reviewCount,
      avgRating: scraped.avgRating ?? l.avgRating,
      isSuperhost: scraped.isSuperhost ?? l.isSuperhost,
      bedrooms: scraped.bedrooms ?? l.bedrooms,
      bathrooms: scraped.bathrooms ?? l.bathrooms,
      guestCapacity: scraped.guestCapacity ?? l.guestCapacity,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, id));
  console.log(`✓ Updated listing.photos`);

  // Delete the old (bogus) preview so the next /l page load doesn't keep
  // serving the cartoon images. The pipeline will write a new one.
  await db.delete(previews).where(eq(previews.listingId, id));
  console.log(`✓ Deleted old preview rows`);

  // Re-fire the qualification → preview chain
  await inngest.send({
    name: "listings/qualified",
    data: { listingId: id },
  });
  console.log(`✓ Fired listings/qualified — Inngest will regenerate preview within ~30 sec`);

  console.log(`\nWatch /l/${l.slug} — preview should populate within 1-2 minutes.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
