import { NextRequest, NextResponse } from "next/server";
import { db, listings, previews } from "@/db";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const [row] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [preview] = await db
    .select()
    .from(previews)
    .where(eq(previews.listingId, id))
    .orderBy(desc(previews.createdAt))
    .limit(1);

  let phase: "scraping" | "generating" | "ready" | "failed" = "scraping";
  if (preview) phase = "ready";
  else if (row.photos && row.photos.length > 0) phase = "generating";
  if (row.qualificationReason?.includes("scrape failed") || row.qualificationReason?.includes("no photos")) {
    phase = "failed";
  }

  return NextResponse.json({
    phase,
    slug: row.slug,
    address: row.address,
    error: phase === "failed" ? sanitizeError(row.qualificationReason) : undefined,
  });
}

function sanitizeError(raw: string | null | undefined): string {
  if (!raw) {
    return "We couldn't pull that listing. Try a different URL or paste the address directly.";
  }
  const lower = raw.toLowerCase();
  if (lower.includes("hard limit") || lower.includes("monthly usage") || lower.includes("rate limit")) {
    return "We're experiencing high demand right now. Leave your email below and we'll process this for you within the hour.";
  }
  if (lower.includes("no photos") || (lower.includes("photos") && lower.includes("0"))) {
    return "We couldn't find photos on this listing yet. If it just went up, try again in a few minutes.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "That listing URL didn't resolve — it may have been delisted or moved.";
  }
  if (lower.includes("login") || lower.includes("403") || lower.includes("forbidden")) {
    return "That listing is behind a login wall. Try the public Zillow/Redfin URL instead.";
  }
  return "Something went wrong on our end. We've been notified — try again in a few minutes.";
}
