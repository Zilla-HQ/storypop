/**
 * Seed a single listing for the happy-path test. Use:
 *   npx tsx --env-file=.env.local scripts/seed-listing.ts --email you+test@yourdomain.com
 * Requires DATABASE_URL. Does NOT emit the Inngest event — trigger
 * listings/ingested manually from the Inngest dev UI.
 */
import { db, listings } from "@/db";
import { slugify } from "@/lib/utils";

async function main() {
  const args = process.argv.slice(2);
  const email = getArg(args, "--email") ?? "seed@example.com";

  const address = "1234 Sample Ave";
  const zip = "78701";
  const sourceId = `seed-${Date.now()}`;

  const [row] = await db
    .insert(listings)
    .values({
      source: "zillow",
      sourceId,
      address,
      city: "Austin",
      state: "TX",
      zip,
      price: 68_500_000, // $685k
      dom: 4,
      listingType: "single_family",
      photos: [
        "https://placehold.co/1200x800/e2e8f0/475569?text=Kitchen",
        "https://placehold.co/1200x800/e2e8f0/475569?text=Living",
        "https://placehold.co/1200x800/e2e8f0/475569?text=Bedroom",
        "https://placehold.co/1200x800/e2e8f0/475569?text=Bath",
        "https://placehold.co/1200x800/e2e8f0/475569?text=Exterior",
      ],
      agentName: "Test Agent",
      agentEmail: email,
      agentPhone: "+15125550123",
      brokerage: "Seed Realty",
      slug: `${slugify(`${address} ${zip}`)}-${sourceId.slice(-6)}`,
    })
    .returning();

  console.log(`Seeded listing ${row.id}`);
  console.log(`Slug: /l/${row.slug}`);
  console.log(`Agent email: ${email}`);
  console.log(`\nTrigger qualification in Inngest dev UI with:`);
  console.log(`  event: listings/ingested`);
  console.log(`  data: { "listingId": "${row.id}", "source": "zillow" }`);
}

function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
