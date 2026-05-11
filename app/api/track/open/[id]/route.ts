/**
 * Email open tracking pixel.
 *
 * Called by an `<img>` embedded in outreach emails. Marks the
 * outreach_event opened (idempotent — only writes if not yet opened) and
 * upgrades listing.status to "opened" only if it wasn't already in a more-
 * advanced state.
 *
 * Engaged-state guard: a lead that already replied / paid will NOT get
 * downgraded to "opened" if their pixel fires from cache. Without this, every
 * old email loaded by the prospect's mail client would regress the lead state
 * and break analytics.
 *
 * Always returns a 1x1 transparent GIF. Errors are swallowed — the prospect
 * sees a blank pixel either way and we don't want a logging issue blocking
 * email rendering.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, outreachEvents, listings } from "@/db";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

// Lead statuses that should NEVER be downgraded by an open/click event.
// A lead that replied or purchased shouldn't regress to "opened" because
// the prospect's mail client re-fetched the pixel weeks later.
const ENGAGED_STATUSES = new Set([
  "replied",
  "interested",
  "decline",
  "complex",
  "purchased",
  "fulfilled",
  "unsubscribed",
]);

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Fire-and-forget — never block the pixel response on DB writes.
  recordOpen(id).catch((err) => {
    console.warn("[track/open] failed:", err?.message);
  });

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}

async function recordOpen(outreachEventId: string): Promise<void> {
  // 1. Mark the outreach_event opened — only if not already opened (idempotent).
  const [updated] = await db
    .update(outreachEvents)
    .set({ firstOpenedAt: sql`COALESCE(${outreachEvents.firstOpenedAt}, NOW())` })
    .where(eq(outreachEvents.id, outreachEventId))
    .returning({ listingId: outreachEvents.listingId });

  if (!updated) return;

  // 2. Upgrade listing.status to "opened" — but ONLY if not already engaged.
  await db
    .update(listings)
    .set({ status: "opened" })
    .where(sql`${listings.id} = ${updated.listingId} AND ${listings.status} NOT IN (${sql.raw([...ENGAGED_STATUSES].map((s) => `'${s}'`).join(","))})`);
}
