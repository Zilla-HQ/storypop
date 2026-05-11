import { NextResponse } from "next/server";
import { db, previews } from "@/db";
import { count } from "drizzle-orm";

export const runtime = "nodejs";
// Skip prerender — opens a Postgres connection at build time, which combined
// with the ~380 other static pages exhausts the Supabase session pool.
// Cache the response at the edge for 60s instead.
export const dynamic = "force-dynamic";

export async function GET() {
  // Count is the number of completed previews — represents real generation
  // volume, not raw listings (which includes stub records).
  const [row] = await db.select({ n: count() }).from(previews);
  return NextResponse.json(
    { count: Number(row.n) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
