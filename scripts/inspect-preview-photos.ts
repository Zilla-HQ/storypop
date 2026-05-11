import { db, listings, previews } from "@/db";
import { eq } from "drizzle-orm";

async function main() {
  const id = process.argv[2] ?? "25d2467f-6ea5-4674-96e4-7e713a07aa84";
  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l) {
    console.error("not found");
    process.exit(1);
  }

  console.log(`LISTING: ${l.scrapedTitle}`);
  console.log(`Total photos scraped from Airbnb: ${l.photos.length}`);
  console.log("");
  console.log("ALL PHOTOS (in scrape order):");
  for (let i = 0; i < l.photos.length; i++) {
    console.log(`  [${i}] ${l.photos[i]}`);
  }

  const ps = await db.select().from(previews).where(eq(previews.listingId, id));
  for (const p of ps) {
    console.log(`\n══ PREVIEW ${p.id} ══`);
    console.log(`  Service: ${p.serviceId}`);
    console.log(`  Style:   ${p.stylePreset}`);
    console.log(`\n  ORIGINALS (which photos the pipeline picked to demo):`);
    p.originalPhotoUrls.forEach((u, i) => {
      const idx = l.photos.indexOf(u);
      console.log(`    [${i}] index_in_scrape=${idx} ${u}`);
    });
    console.log(`\n  ENHANCED (the "after" output the customer saw):`);
    p.enhancedPhotoUrls.forEach((u, i) => console.log(`    [${i}] ${u}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
