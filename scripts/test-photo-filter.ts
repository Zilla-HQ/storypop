/**
 * Smoke-test the post-fix airbnb-direct photo extractor against
 * William's listing (and any other URL passed as arg) to confirm
 * the filter now skips AirbnbPlatformAssets.
 */
import { fetchAirbnbListingDirect } from "@/lib/airbnb-direct";

async function main() {
  const url = process.argv[2] ?? "https://www.airbnb.com/rooms/1503101014532268524";
  console.log(`Testing: ${url}\n`);

  const result = await fetchAirbnbListingDirect(url);
  if (!result) {
    console.error("✗ fetchAirbnbListingDirect returned null");
    process.exit(1);
  }

  console.log(`Title:           ${result.scrapedTitle}`);
  console.log(`Photo count:     ${result.photos.length}`);
  console.log("");
  console.log("First 5 photos:");
  result.photos.slice(0, 5).forEach((p, i) => console.log(`  [${i}] ${p}`));

  const platformAssets = result.photos.filter(
    (p) =>
      p.includes("/AirbnbPlatformAssets/") ||
      p.includes("/AirCover/") ||
      p.includes("/Categories/"),
  );
  if (platformAssets.length > 0) {
    console.log(`\n✗ FILTER FAILED: ${platformAssets.length} platform-asset URLs leaked through:`);
    platformAssets.forEach((p) => console.log(`  ${p}`));
    process.exit(1);
  } else {
    console.log(`\n✓ Filter clean — 0 platform-asset URLs in photo list`);
  }

  const hasRealListingPhotos = result.photos.some(
    (p) => p.includes("/prohost-api/Hosting-") || p.includes("/miso/Hosting-"),
  );
  if (!hasRealListingPhotos && result.photos.length > 0) {
    console.warn(`\n⚠ No /prohost-api/ or /miso/Hosting- URLs detected. May need additional path patterns.`);
  } else if (hasRealListingPhotos) {
    console.log(`✓ Real listing photos detected (/prohost-api or /miso/Hosting-)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
