import { db, listings } from "@/db";
import { eq } from "drizzle-orm";

async function main() {
  const id = process.argv[2] ?? "25d2467f-6ea5-4674-96e4-7e713a07aa84";
  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l) {
    console.error(`No listing for id=${id}`);
    process.exit(1);
  }
  console.log("Listing slug:    ", l.slug);
  console.log("Airbnb URL:      ", l.listingUrl);
  console.log("Address:         ", l.address, "·", l.city, l.state);
  console.log("Title:           ", l.scrapedTitle);
  console.log("Photos:          ", l.photos.length);
  console.log("Created:         ", l.createdAt);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
