import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 15 });

try {
  const [{ n: listingCount }] = await sql`SELECT count(*)::int AS n FROM relist.listings`;
  const [{ n: qualified }] = await sql`SELECT count(*)::int AS n FROM relist.listings WHERE qualified = true`;
  const [{ n: previews }] = await sql`SELECT count(*)::int AS n FROM relist.previews`;
  const [{ n: outreach }] = await sql`SELECT count(*)::int AS n FROM relist.outreach_events`;
  const [{ n: orders }] = await sql`SELECT count(*)::int AS n FROM relist.orders`;
  const [{ n: paid }] = await sql`SELECT count(*)::int AS n FROM relist.orders WHERE status = 'paid'`;
  const [{ n: costs }] = await sql`SELECT coalesce(sum(cost_cents),0)::int AS n FROM relist.agent_costs`;

  const recentListings = await sql`
    SELECT created_at, source, city, state, qualified
    FROM relist.listings
    ORDER BY created_at DESC LIMIT 3`;
  const recentOutreach = await sql`
    SELECT created_at, status, subject
    FROM relist.outreach_events
    ORDER BY created_at DESC LIMIT 3`;

  console.log("=== DB state ===");
  console.log(`listings        : ${listingCount}`);
  console.log(`   qualified    : ${qualified}`);
  console.log(`previews        : ${previews}`);
  console.log(`outreach_events : ${outreach}`);
  console.log(`orders          : ${orders}  (paid: ${paid})`);
  console.log(`agent spend     : $${(costs / 100).toFixed(2)}`);
  console.log("\nRecent listings:");
  if (recentListings.length === 0) console.log("  (none)");
  else for (const r of recentListings) console.log(`  ${r.created_at.toISOString()} ${r.source} ${r.city}, ${r.state} qualified=${r.qualified}`);
  console.log("\nRecent outreach:");
  if (recentOutreach.length === 0) console.log("  (none)");
  else for (const r of recentOutreach) console.log(`  ${r.created_at.toISOString()} ${r.status} "${r.subject?.slice(0, 60)}"`);
} finally {
  await sql.end();
}
