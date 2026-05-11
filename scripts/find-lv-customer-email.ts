/**
 * Run the host-enrichment pipeline against the Las Vegas customer's
 * listing. They never entered an email at Stripe Checkout, so this is
 * the only way to find them — by enriching their Airbnb-host email.
 */
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { fetchAirbnbListingDirect } from "@/lib/airbnb-direct";
import { enrichHostEmail } from "@/lib/host-enrich";

async function main() {
  const listingId = "9f84af86-c8ad-490d-8e8e-d2685479584d";
  const [l] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!l) {
    console.error("listing not found");
    process.exit(1);
  }

  console.log(`LISTING: ${l.scrapedTitle}`);
  console.log(`  URL:           ${l.listingUrl}`);
  console.log(`  Host name:     ${l.agentName ?? "(not scraped)"}`);
  console.log(`  Host email:    ${l.agentEmail ?? "(not enriched)"}`);
  console.log(`  Host about:    ${l.hostAbout?.slice(0, 200) ?? "(none)"}`);

  // Re-scrape if we don't have hostName — the original scrape may have skipped it
  if (!l.agentName && l.listingUrl) {
    console.log(`\n  Re-scraping for fresh host info...`);
    const fresh = await fetchAirbnbListingDirect(l.listingUrl);
    if (fresh?.agentName) {
      console.log(`  Fresh host name: ${fresh.agentName}`);
      l.agentName = fresh.agentName;
    }
    if (fresh?.hostAbout) {
      console.log(`  Fresh host bio:  ${fresh.hostAbout.slice(0, 200)}`);
      l.hostAbout = fresh.hostAbout;
    }
    if (fresh?.scrapedDescription) {
      l.scrapedDescription = fresh.scrapedDescription;
    }
  }

  console.log(`\n  Running enrichment pipeline...`);
  const result = await enrichHostEmail({
    hostName: l.agentName,
    city: l.city,
    state: l.state,
    scrapedTitle: l.scrapedTitle,
    scrapedDescription: l.scrapedDescription,
    hostAbout: l.hostAbout,
    hostHighlights: l.hostHighlights,
    listingPhotos: l.photos,
    airbnbListingUrl: l.listingUrl,
  });

  if (result) {
    console.log(`\n  ✓ FOUND EMAIL: ${result.email}`);
    console.log(`    Source:        ${result.source}`);
    // Persist to listing row
    await db
      .update(listings)
      .set({
        agentEmail: result.email,
        hostEmailSource: result.source,
        agentName: l.agentName,
        hostAbout: l.hostAbout,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId));
    console.log(`    ✓ Persisted to listing row`);
  } else {
    console.log(`\n  ✗ Enrichment returned null — no email findable`);
    console.log(`    Tried: regex, Hunter domain, Hunter company, Claude web_search`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
