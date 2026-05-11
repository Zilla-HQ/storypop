/**
 * Email link-click tracking + redirect.
 *
 * Click-through links in outreach emails route through this endpoint
 * (`/api/track/click/<outreachEventId>?to=<encoded_destination>`), which
 * records the click and 302s to the real destination.
 *
 * Same engaged-state guard as the open pixel: an already-engaged lead
 * (replied / purchased / unsubscribed / etc.) will NOT regress to "clicked".
 *
 * Important — validate the destination URL (allowlist only http(s) + only
 * domains we control or explicitly trust) so this route can't be used as an
 * open redirector. Phishing campaigns love open redirectors.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, outreachEvents, listings } from "@/db";
import { eq, sql } from "drizzle-orm";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const ENGAGED_STATUSES = new Set([
  "replied",
  "interested",
  "decline",
  "complex",
  "purchased",
  "fulfilled",
  "unsubscribed",
]);

// Allowlist for redirect destinations. Defaults to NEXT_PUBLIC_APP_URL only,
// add more via TRACK_CLICK_ALLOWED_HOSTS (comma-separated host list).
function isAllowedDestination(url: URL): boolean {
  const ownHost = (() => {
    try { return new URL(env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!).host; }
    catch { return ""; }
  })();
  const extra = (env("TRACK_CLICK_ALLOWED_HOSTS", "") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const allowedHosts = new Set([ownHost, ...extra].filter(Boolean));
  return allowedHosts.has(url.host) && (url.protocol === "http:" || url.protocol === "https:");
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const to = req.nextUrl.searchParams.get("to") || "";

  // Validate the redirect destination BEFORE doing any DB work — if the URL
  // is bad, we 400 immediately rather than recording a click on a phishing
  // attempt.
  let dest: URL;
  try {
    dest = new URL(to);
  } catch {
    return NextResponse.json({ error: "invalid `to` url" }, { status: 400 });
  }
  if (!isAllowedDestination(dest)) {
    return NextResponse.json({ error: "destination not in allowlist" }, { status: 400 });
  }

  // Fire-and-forget — never block the redirect on DB writes.
  recordClick(id).catch((err) => {
    console.warn("[track/click] failed:", err?.message);
  });

  return NextResponse.redirect(dest, 302);
}

async function recordClick(outreachEventId: string): Promise<void> {
  const [updated] = await db
    .update(outreachEvents)
    .set({
      // Mark both opened (a click implies a prior open) and clicked
      firstOpenedAt: sql`COALESCE(${outreachEvents.firstOpenedAt}, NOW())`,
      firstClickedAt: sql`COALESCE(${outreachEvents.firstClickedAt}, NOW())`,
    })
    .where(eq(outreachEvents.id, outreachEventId))
    .returning({ listingId: outreachEvents.listingId });

  if (!updated) return;

  await db
    .update(listings)
    .set({ status: "clicked" })
    .where(sql`${listings.id} = ${updated.listingId} AND ${listings.status} NOT IN (${sql.raw([...ENGAGED_STATUSES].map((s) => `'${s}'`).join(","))})`);
}
