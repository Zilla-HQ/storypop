import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings, previews } from "@/db";
import { eq } from "drizzle-orm";
import { generateStagedPreview } from "@/lib/falai";
import { applyTextWatermark } from "@/lib/watermark";
import { uploadToR2, signedR2Url } from "@/lib/r2";
import { pickBestForStaging } from "@/lib/room-classify";

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
 * Bypass-Inngest sync preview generator. For when the operator needs a
 * specific listing's preview produced NOW without waiting in the
 * Inngest concurrency queue (which is bottlenecked at 4 parallel during
 * mass cold-seeds).
 *
 *   POST /api/admin/sync-preview?listingId=X&serviceId=photo-staging&n=2
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  const serviceId = url.searchParams.get("serviceId") ?? "photo-staging";
  const n = Math.min(4, Number(url.searchParams.get("n") ?? "2"));
  if (!listingId) return NextResponse.json({ error: "?listingId required" }, { status: 400 });

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const allPhotos = listing.photos ?? [];
  if (allPhotos.length === 0) return NextResponse.json({ error: "no photos" }, { status: 400 });

  // Use Claude vision to classify photos + pick the N best INTERIOR rooms
  // for staging. Without this we pick photos[0..n] blindly which for
  // beachfront / luxury Zillow listings is usually aerial drone shots —
  // applying an interior-staging prompt to an aerial scene makes Kontext
  // hallucinate a different building entirely.
  const ranked = await pickBestForStaging(allPhotos, n);
  if (ranked.length === 0) {
    return NextResponse.json(
      { error: "no stageable interior photos detected" },
      { status: 400 },
    );
  }

  const trace: Record<string, unknown>[] = [];
  const originalUrls: string[] = [];
  const enhancedUrls: string[] = [];

  for (let i = 0; i < ranked.length; i++) {
    const src = ranked[i].url;
    const roomHint = ranked[i].classification.kind;
    try {
      // Mirror Zillow source to R2 first — fal.ai sometimes 403s on
      // image.zillowstatic.com from its IP range, R2 signed URLs are reliable.
      const sourceRes = await fetch(src);
      if (!sourceRes.ok) throw new Error(`source ${sourceRes.status}`);
      const sourceBuf = Buffer.from(await sourceRes.arrayBuffer());
      const sourceKey = `previews/${listingId}/source-${String(i).padStart(3, "0")}.jpg`;
      await uploadToR2(sourceKey, sourceBuf, "image/jpeg");
      const sourceR2Url = await signedR2Url(sourceKey, 3600);

      const result = await generateStagedPreview({
        sourceImageUrl: sourceR2Url,
        styleFragment:
          "modern contemporary interior, clean lines, neutral palette, natural light, minimalist furniture",
        roomHint,
      });
      const r = await fetch(result.url);
      const buf = Buffer.from(await r.arrayBuffer());
      const stamped = await applyTextWatermark(buf, "Virtually Staged", {
        position: "bottom-left",
        opacity: 0.7,
      });
      const key = `previews/${listingId}/${serviceId}-${String(i).padStart(3, "0")}.jpg`;
      await uploadToR2(key, stamped, "image/jpeg");
      const enhancedSignedUrl = await signedR2Url(key, 60 * 60 * 24 * 7);

      originalUrls.push(src);
      enhancedUrls.push(enhancedSignedUrl);
      trace.push({ step: i, ok: true });
    } catch (e) {
      trace.push({ step: i, ok: false, error: (e as Error).message });
    }
  }

  if (enhancedUrls.length === 0) {
    return NextResponse.json({ error: "no enhancements produced", trace }, { status: 500 });
  }

  // Upsert the preview row (replace any prior empty preview for this service)
  await db
    .delete(previews)
    .where(eq(previews.listingId, listingId));
  const [prev] = await db
    .insert(previews)
    .values({
      listingId,
      serviceId,
      originalPhotoUrls: originalUrls,
      enhancedPhotoUrls: enhancedUrls,
      stylePreset: "modern",
      costCents: 6 * enhancedUrls.length,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    listing: listing.address,
    service_id: serviceId,
    preview_id: prev.id,
    enhanced_count: enhancedUrls.length,
    sample_enhanced_url: enhancedUrls[0],
    trace,
  });
}
