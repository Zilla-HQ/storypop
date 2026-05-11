/**
 * Size the warm-lead opportunity. Anyone who pasted an Airbnb URL but
 * didn't pay is materially warmer than cold leads — they self-selected
 * into the funnel. Worth a discount-recovery email blast.
 */
import { db, listings, orders, previews } from "@/db";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";

async function main() {
  // ─── Total self-serve listings ────────────────────────────────────
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(listings)
    .where(eq(listings.source, "self_serve"));

  // ─── Self-serve listings with previews (saw the deliverable) ──────
  const [{ withPreview }] = await db
    .select({ withPreview: sql<number>`count(distinct ${previews.listingId})::int` })
    .from(previews)
    .innerJoin(listings, eq(previews.listingId, listings.id))
    .where(eq(listings.source, "self_serve"));

  // ─── Self-serve listings that PAID ────────────────────────────────
  const [{ paid }] = await db
    .select({ paid: sql<number>`count(distinct ${orders.listingId})::int` })
    .from(orders)
    .innerJoin(listings, eq(orders.listingId, listings.id))
    .where(and(eq(listings.source, "self_serve"), eq(orders.status, "paid")));

  // ─── Self-serve listings that started checkout but never paid (the warm-lead pool) ──
  // Has at least one order in pending/refunded/etc., not a 'paid' one
  const orderedListingIds = db
    .select({ id: orders.listingId })
    .from(orders);

  const [{ pastedNoPaid }] = await db
    .select({ pastedNoPaid: sql<number>`count(*)::int` })
    .from(listings)
    .where(
      and(
        eq(listings.source, "self_serve"),
        notInArray(listings.id, orderedListingIds),
      ),
    );

  // ─── Fetch the listings + emails for outreach ─────────────────────
  const orphans = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      address: listings.address,
      city: listings.city,
      scrapedTitle: listings.scrapedTitle,
      agentEmail: listings.agentEmail,
      agentName: listings.agentName,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .where(
      and(
        eq(listings.source, "self_serve"),
        notInArray(listings.id, orderedListingIds),
      ),
    )
    .orderBy(sql`${listings.createdAt} desc`);

  console.log(`\n══════ WARM LEAD AUDIT ══════`);
  console.log(`  Total self-serve URL pastes:       ${total}`);
  console.log(`  ... with preview generated:        ${withPreview}`);
  console.log(`  ... that paid:                     ${paid}`);
  console.log(`  ... pasted but never even started checkout: ${pastedNoPaid}`);
  console.log(`     of which have a host email captured:    ${orphans.filter((l) => l.agentEmail).length}`);
  console.log(`     of which DON'T have host email:         ${orphans.filter((l) => !l.agentEmail).length}`);

  console.log(`\n══════ SAMPLE OF WARM LEADS ══════`);
  for (const l of orphans.slice(0, 10)) {
    console.log(`  ${l.id.slice(0, 8)} ${l.city ?? "?"}  email=${l.agentEmail ?? "(none)"}  title=${(l.scrapedTitle ?? "").slice(0, 50)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
