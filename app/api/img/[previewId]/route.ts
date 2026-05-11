import { NextRequest, NextResponse } from "next/server";
import { db, previews } from "@/db";
import { eq } from "drizzle-orm";
import { signedR2Url } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * Stable image proxy. Email recipients see a permanent URL like
 * /api/img/<previewId>?i=0&kind=after — the proxy looks up the R2 key
 * from the DB and 302s to a freshly-signed URL on every fetch.
 *
 * Why this exists: R2 pre-signed URLs expire 7 days after generation.
 * Previews older than 7 days have dead URLs in the DB, so emails sent
 * with them break. This indirection means email images NEVER expire.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ previewId: string }> },
) {
  const { previewId } = await params;
  if (!previewId || !/^[a-f0-9-]{36}$/.test(previewId)) {
    return new NextResponse("invalid preview id", { status: 400 });
  }
  const url = new URL(req.url);
  const idx = parseInt(url.searchParams.get("i") ?? "0", 10);
  const kind = url.searchParams.get("kind") ?? "after"; // "before" | "after"

  const [row] = await db
    .select()
    .from(previews)
    .where(eq(previews.id, previewId))
    .limit(1);
  if (!row) {
    return new NextResponse("preview not found", { status: 404 });
  }

  const list =
    kind === "before" ? row.originalPhotoUrls : row.enhancedPhotoUrls;
  const storedUrl = list[Math.max(0, Math.min(idx, list.length - 1))];
  if (!storedUrl) {
    return new NextResponse("no image at index", { status: 404 });
  }

  // Extract the R2 object key from the stored URL. The path is everything
  // after the bucket host, minus the leading slash. Works for both
  // r2.cloudflarestorage.com and any custom-domain public URLs.
  let key = "";
  try {
    const u = new URL(storedUrl);
    key = u.pathname.replace(/^\/+/, "");
  } catch {
    return new NextResponse("malformed stored url", { status: 500 });
  }

  // For "before" images that are NOT R2-hosted (Mapbox satellite tiles,
  // Zillow CDN photos), proxy through to the original — those URLs don't
  // expire the same way.
  const isR2Hosted =
    storedUrl.includes(".r2.cloudflarestorage.com/") ||
    storedUrl.includes("relist-photos");
  if (!isR2Hosted) {
    return NextResponse.redirect(storedUrl, 302);
  }

  let fresh: string;
  try {
    fresh = await signedR2Url(key);
  } catch (err) {
    return new NextResponse(
      `r2 sign failed: ${(err as Error).message.slice(0, 100)}`,
      { status: 500 },
    );
  }

  // 302 redirect with a short cache hint (client/proxy can cache 5 min;
  // signed URL is good for 7 days so even cached redirects work).
  return NextResponse.redirect(fresh, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
