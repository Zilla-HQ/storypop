import { NextRequest, NextResponse } from "next/server";
import { db, outreachEvents } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Server-side click tracking + redirect.
 *
 *   /c/<outreachEventId>/<kind>/<slug>
 *
 * Every outbound link in a cold email points at this route. We log
 * the click into `outreach_events.firstClickedAt` (without downgrading
 * later states like 'replied'), then 302 to the canonical destination
 * derived from `kind` + `slug`.
 *
 * Why server-side and not pixel-based:
 *   - More reliable than image-based click tracking (image tracking
 *     gets stripped by privacy-aware clients).
 *   - Gives us the same "first click" signal as a tracking pixel
 *     without leaning on an external service.
 *   - Plays nicely with email clients' "preview" prefetches — the
 *     timestamp is set on first ever hit and never overwritten.
 *
 * Kind/slug routing — extend per merchant. The defaults below cover:
 *   /c/<id>/preview/<slug>   →  /l/<slug>            (listing/product page)
 *   /c/<id>/checkout/<slug>  →  /l/<slug>?checkout=1 (checkout intent)
 *   /c/<id>/unsub/<token>    →  /unsubscribe?t=<token>
 *   /c/<id>/footer/<n>       →  /                    (footer brand link)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; kind: string; slug: string }> },
) {
  const { id, kind, slug } = await ctx.params;

  // Best-effort log. Don't block the redirect on DB failure — a slow
  // DB shouldn't break a customer's click.
  void recordClick(id).catch(() => undefined);

  const target = resolveTarget(kind, slug, req);
  return NextResponse.redirect(target, { status: 302 });
}

async function recordClick(outreachEventId: string): Promise<void> {
  if (!isUuid(outreachEventId)) return;
  await db
    .update(outreachEvents)
    .set({
      firstClickedAt: new Date(),
      status: "clicked",
    })
    .where(eq(outreachEvents.id, outreachEventId));
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function resolveTarget(kind: string, slug: string, req: NextRequest): URL {
  const base = new URL(req.url);
  switch (kind) {
    case "preview":
      return new URL(`/l/${encodeURIComponent(slug)}`, base);
    case "checkout":
      return new URL(`/l/${encodeURIComponent(slug)}?checkout=1`, base);
    case "unsub":
      return new URL(`/unsubscribe?t=${encodeURIComponent(slug)}`, base);
    case "footer":
      return new URL("/", base);
    default:
      return new URL("/", base);
  }
}
