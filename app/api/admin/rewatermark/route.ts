import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, previews } from "@/db";
import { sql } from "drizzle-orm";
import { uploadToR2 } from "@/lib/r2";
import { applyTextWatermark } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Re-watermark all stored agent-side previews. The previous watermark
 * implementation used inline SVG text which rendered as garbled tofu
 * glyphs on the Vercel runtime (font fallback issue). This endpoint
 * replaces those broken bytes IN-PLACE at the same R2 key, so all
 * existing email image references via /api/img/<previewId> immediately
 * serve the corrected image without changing URLs.
 *
 *   POST /api/admin/rewatermark
 *   Header: X-Trigger-Secret: <TRIGGER_SECRET>
 *   ?dry=1 — count-only dry run
 *   ?limit=N — process at most N previews (default unlimited)
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const limit = parseInt(url.searchParams.get("limit") ?? "0", 10) || 9999;

  // Pull all photo-staging + twilight-exterior previews that haven't
  // been rewatermarked yet. The rewatermarked_at column was added so
  // chunked passes don't re-process the same rows.
  const rows = (await db.execute(sql`
    SELECT id, listing_id, service_id, enhanced_photo_urls
    FROM relist.previews
    WHERE service_id IN ('photo-staging', 'twilight-exterior')
      AND jsonb_array_length(enhanced_photo_urls) > 0
      AND rewatermarked_at IS NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    listing_id: string;
    service_id: string;
    enhanced_photo_urls: string[];
  }>;

  if (dry) {
    const totalImages = rows.reduce((acc, r) => acc + r.enhanced_photo_urls.length, 0);
    return NextResponse.json({ dry: true, preview_count: rows.length, image_count: totalImages });
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.enhanced_photo_urls.length; i++) {
      processed += 1;
      const storedUrl = row.enhanced_photo_urls[i];

      // Extract R2 key from the stored URL — same parsing logic as /api/img.
      let key = "";
      try {
        const u = new URL(storedUrl);
        key = u.pathname.replace(/^\/+/, "");
      } catch {
        failed += 1;
        errors.push(`malformed url for preview ${row.id} idx ${i}`);
        continue;
      }
      if (!key.startsWith("previews/")) {
        // Skip — not a key we manage (e.g., Mapbox tiles).
        continue;
      }

      // Fetch the current bytes via the proxy path (which re-signs).
      // Easiest: re-fetch via a freshly-signed URL.
      try {
        // Use signedR2Url from lib/r2 — re-sign at call time.
        const { signedR2Url } = await import("@/lib/r2");
        const fresh = await signedR2Url(key);
        const res = await fetch(fresh);
        if (!res.ok) {
          failed += 1;
          errors.push(`fetch ${key} → ${res.status}`);
          continue;
        }
        const inputBuf = Buffer.from(await res.arrayBuffer());

        // Apply the new (working) watermark. Re-watermarking an
        // already-watermarked image produces a slightly-darker label
        // box but is otherwise visually fine — and most existing
        // images have garbled bytes where the text was, which the new
        // watermark will overlay cleanly.
        const label = row.service_id === "twilight-exterior" ? "Enhanced" : "Virtually Staged";
        const stamped = await applyTextWatermark(inputBuf, label, {
          position: "bottom-right",
          opacity: 0.75,
        });

        // Re-upload at the SAME key — replaces content. The proxy will
        // serve the new bytes on next fetch (5 min cache window).
        await uploadToR2(key, stamped, "image/jpeg");
        updated += 1;
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`preview ${row.id} idx ${i}: ${msg.slice(0, 150)}`);
      }
    }
    // Mark this preview row as processed so the next chunk skips it.
    // Done after all images in the row are attempted; we still mark
    // even if some images failed, to avoid infinite retry loops.
    await db.execute(
      sql`UPDATE relist.previews SET rewatermarked_at = now() WHERE id = ${row.id}`,
    );
  }

  return NextResponse.json({
    processed,
    updated,
    failed,
    preview_rows: rows.length,
    error_count: errors.length,
    errors: errors.slice(0, 10),
  });
}
