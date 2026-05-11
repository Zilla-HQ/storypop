import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import archiver from "archiver";
import { PassThrough } from "stream";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { generateStagedPreview } from "@/lib/falai";
import { applyTextWatermark } from "@/lib/watermark";
import { uploadToR2, signedR2Url } from "@/lib/r2";
import { sendComplianceEmail } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { shortAddress } from "@/lib/utils";

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
 * One-shot lightweight delivery — bypasses the full fulfillment agent
 * (no QC retry, no auto-refund, no minimum-photo gate). Stages every
 * photo it can via fal.ai, watermarks the successful ones, zips them,
 * and emails the recipient. Designed for ad-hoc demo / sample sends.
 *
 *   POST /api/admin/quick-deliver?listingId=<uuid>&email=<recipient>&max=20
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  const email = url.searchParams.get("email");
  const max = Math.min(20, Number(url.searchParams.get("max") ?? "12"));
  if (!listingId || !email) {
    return NextResponse.json(
      { error: "?listingId=<uuid>&email=<recipient> required" },
      { status: 400 },
    );
  }

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) {
    return NextResponse.json({ error: "listing not found" }, { status: 404 });
  }
  const sources = (listing.photos ?? []).slice(0, max);
  if (sources.length === 0) {
    return NextResponse.json({ error: "listing has no photos" }, { status: 400 });
  }

  const trace: Record<string, unknown>[] = [];
  const stagedKeys: string[] = [];
  const staged: { key: string; sourceUrl: string }[] = [];

  // Stage every photo we can. No QC. No retry. Skip on error.
  // We pre-fetch each source image and re-host it on R2 because Zillow's
  // CDN blocks fal.ai's IP range with 403 — fal.ai's servers can't fetch
  // image.zillow.com directly. R2's URLs are public + signed, fal.ai
  // can pull from there reliably.
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    try {
      // 1. Mirror the source onto R2 so fal.ai can fetch it
      const sourceRes = await fetch(src);
      if (!sourceRes.ok) {
        throw new Error(`source fetch ${sourceRes.status}`);
      }
      const sourceBuf = Buffer.from(await sourceRes.arrayBuffer());
      const sourceKey = `quick-deliveries/${listingId}/source-${String(i).padStart(3, "0")}.jpg`;
      await uploadToR2(sourceKey, sourceBuf, "image/jpeg");
      const sourceR2Url = await signedR2Url(sourceKey, 60 * 60);

      // 2. Hand R2-hosted URL to fal.ai
      const result = await generateStagedPreview({
        sourceImageUrl: sourceR2Url,
        styleFragment:
          "modern contemporary interior, clean lines, neutral palette, natural light, minimalist furniture",
        roomHint: i === 0 ? "exterior" : "living_room",
      });

      // 3. Download the staged result + watermark + upload final
      const res = await fetch(result.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const stamped = await applyTextWatermark(buf, "Virtually Staged", {
        position: "bottom-left",
        opacity: 0.7,
      });
      const key = `quick-deliveries/${listingId}/${String(i).padStart(3, "0")}.jpg`;
      await uploadToR2(key, stamped, "image/jpeg");
      stagedKeys.push(key);
      staged.push({ key, sourceUrl: src });
      trace.push({ step: `stage-${i}`, ok: true });
    } catch (err) {
      trace.push({ step: `stage-${i}`, ok: false, error: (err as Error).message });
    }
  }

  if (staged.length === 0) {
    return NextResponse.json(
      { error: "no photos staged successfully", trace },
      { status: 500 },
    );
  }

  // Build a zip of all staged photos and upload it.
  const passthrough = new PassThrough();
  const chunks: Buffer[] = [];
  passthrough.on("data", (c) => chunks.push(Buffer.from(c)));
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(passthrough);
  for (const s of staged) {
    const url = await signedR2Url(s.key, 60 * 60);
    const r = await fetch(url);
    const b = Buffer.from(await r.arrayBuffer());
    archive.append(b, { name: s.key.split("/").pop() ?? "photo.jpg" });
  }
  await archive.finalize();
  await new Promise<void>((resolve) => passthrough.on("end", resolve));
  const zipBuf = Buffer.concat(chunks);
  const zipKey = `quick-deliveries/${listingId}/photos.zip`;
  await uploadToR2(zipKey, zipBuf, "application/zip");
  const zipUrl = await signedR2Url(zipKey, 60 * 60 * 24 * 7);

  // Email
  const settings = await getSettings();
  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const addr = shortAddress(listing.address);

  // Show first staged photo inline as a preview
  const sampleAfter = await signedR2Url(staged[0].key, 60 * 60 * 24 * 7);
  const sampleBefore = staged[0].sourceUrl;

  const mjml = `<mjml><mj-body background-color="#f4f5f7">
    <mj-section padding="24px 0 8px"><mj-column>
      <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="32px 32px 8px" border-radius="14px 14px 0 0"><mj-column>
      <mj-text font-size="20px" font-weight="700">Your enhanced photos for ${addr}</mj-text>
      <mj-text font-size="15px">${staged.length} photo${staged.length === 1 ? "" : "s"} from your listing have been virtually staged with our pipeline. NAR-compliant "Virtually Staged" disclosure stamped on every photo.</mj-text>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="8px 16px 0">
      <mj-column padding="0 6px">
        <mj-text align="center" font-size="11px" font-weight="700" color="#64748b" padding="0 0 6px">BEFORE</mj-text>
        <mj-image src="${sampleBefore}" alt="Before" border-radius="10px" padding="0"/>
      </mj-column>
      <mj-column padding="0 6px">
        <mj-text align="center" font-size="11px" font-weight="700" color="#047857" padding="0 0 6px">AFTER</mj-text>
        <mj-image src="${sampleAfter}" alt="After" border-radius="10px" padding="0"/>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="20px 32px 12px"><mj-column>
      <mj-button href="${zipUrl}" background-color="#111827" color="#ffffff" font-size="15px" font-weight="600" padding="6px 0 4px" inner-padding="14px 28px" border-radius="8px" align="left">
        Download all ${staged.length} photos (zip)
      </mj-button>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
      <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
      <mj-text font-size="12px" color="#64748b" line-height="1.6">
        ✓ NAR-compliant "Virtually Staged" disclosure on every photo<br/>
        ✓ MLS-resolution<br/>
        ✓ Free to keep and use
      </mj-text>
    </mj-column></mj-section>
  </mj-body></mjml>`;

  const text = `Your enhanced photos for ${listing.address}\n\n${staged.length} photo(s) virtually staged with our pipeline.\n\nDownload zip: ${zipUrl}\n\n— Realscale`;

  const sendResult = await sendComplianceEmail({
    to: email,
    fromDomain,
    subject: `Your enhanced photos for ${addr}`,
    mjml,
    text,
    listingId: listing.id,
    idempotencyKey: `quick-deliver-${listingId}-${email}-${Date.now()}`,
  });

  return NextResponse.json({
    ok: true,
    sent_to: email,
    listing: listing.address,
    photos_staged: staged.length,
    photos_attempted: sources.length,
    zip_url: zipUrl,
    resend_id: sendResult.id,
    trace,
  });
}
