/**
 * Run the existing host-enrichment chain over qualified listings that
 * have NO host email yet. Hunter free tier may be exhausted (50/mo
 * cap), but the regex + Claude web_search paths don't depend on it,
 * so we still pull a meaningful fraction of emails.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-dark-listings.ts --limit=20  (test)
 *   npx tsx --env-file=.env.local scripts/backfill-dark-listings.ts             (full)
 *
 * Read-only on the existing rows except for setting agentEmail +
 * hostEmailSource on success. Skips rows where enrichment returns null.
 */
import { db, listings } from "@/db";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { enrichHostEmail } from "@/lib/host-enrich";

const limit = (() => {
  const flag = process.argv.find((a) => a.startsWith("--limit="));
  return flag ? Math.max(1, parseInt(flag.split("=")[1], 10)) : 1000;
})();

async function main() {
  console.log(`Backfilling host emails — limit=${limit}\n`);

  const rows = await db
    .select({
      id: listings.id,
      agentName: listings.agentName,
      city: listings.city,
      state: listings.state,
      scrapedTitle: listings.scrapedTitle,
      scrapedDescription: listings.scrapedDescription,
      hostAbout: listings.hostAbout,
      hostHighlights: listings.hostHighlights,
      photos: listings.photos,
      listingUrl: listings.listingUrl,
    })
    .from(listings)
    .where(
      and(
        eq(listings.qualified, true),
        isNull(listings.agentEmail),
        isNotNull(listings.agentName),
      ),
    )
    .limit(limit);

  console.log(`Found ${rows.length} dark listings (qualified, no email, has agentName)\n`);

  let found = 0;
  let nullCount = 0;
  const sourceCounts: Record<string, number> = {};
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`[${i + 1}/${rows.length}] [${elapsed}s] ${r.agentName?.padEnd(28)?.slice(0, 28)} → `);
    try {
      const result = await enrichHostEmail({
        hostName: r.agentName,
        city: r.city,
        state: r.state,
        scrapedTitle: r.scrapedTitle,
        scrapedDescription: r.scrapedDescription,
        hostAbout: r.hostAbout,
        hostHighlights: r.hostHighlights,
        listingPhotos: r.photos,
        airbnbListingUrl: r.listingUrl,
      });
      if (result) {
        found++;
        sourceCounts[result.source] = (sourceCounts[result.source] ?? 0) + 1;
        await db
          .update(listings)
          .set({ agentEmail: result.email, hostEmailSource: result.source, updatedAt: new Date() })
          .where(eq(listings.id, r.id));
        console.log(`✓ ${result.email}  (${result.source})`);
      } else {
        nullCount++;
        console.log(`✗ no match`);
      }
    } catch (e) {
      nullCount++;
      console.log(`✗ error: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Found:    ${found} / ${rows.length}  (${((found / rows.length) * 100).toFixed(1)}%)`);
  console.log(`Sources:  ${JSON.stringify(sourceCounts)}`);
  console.log(`Nulls:    ${nullCount}`);
  const stillDark = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.qualified, true), isNull(listings.agentEmail)));
  console.log(`Remaining dark (qualified, still no email): ${stillDark[0]?.n ?? 0}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
