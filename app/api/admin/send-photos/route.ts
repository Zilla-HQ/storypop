import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { shortAddress } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Fast-path: email a listing's existing photos to a recipient as a
 * gallery. No enhancement, no fulfillment-agent gates, no fal.ai. Used
 * for ad-hoc demo sends when the enhancement pipeline is misbehaving
 * and we still want the recipient to see the source material.
 *
 *   POST /api/admin/send-photos?listingId=<uuid>&email=<recipient>&max=12
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
    return NextResponse.json({ error: "?listingId + ?email required" }, { status: 400 });
  }

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const photos = (listing.photos ?? []).slice(0, max);
  if (photos.length === 0) return NextResponse.json({ error: "no photos" }, { status: 400 });

  const settings = await getSettings();
  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const addr = shortAddress(listing.address);

  // Build a 2-column gallery
  const columns = photos
    .map((p, i) => {
      if (i % 2 === 0) {
        const right = photos[i + 1];
        return `<mj-section background-color="#ffffff" padding="6px 16px">
          <mj-column padding="0 6px"><mj-image src="${p}" alt="Photo ${i + 1}" border-radius="6px" padding="0"/></mj-column>
          ${right ? `<mj-column padding="0 6px"><mj-image src="${right}" alt="Photo ${i + 2}" border-radius="6px" padding="0"/></mj-column>` : ""}
        </mj-section>`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const mjml = `<mjml><mj-body background-color="#f4f5f7">
    <mj-section padding="24px 0 8px"><mj-column>
      <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
    </mj-column></mj-section>
    <mj-section background-color="#ffffff" padding="32px 32px 8px" border-radius="14px 14px 0 0"><mj-column>
      <mj-text font-size="20px" font-weight="700">Photos for ${addr}</mj-text>
      <mj-text font-size="15px">Here are the ${photos.length} listing photos for <b>${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}</b>.</mj-text>
      <mj-text font-size="14px" color="#64748b">Virtually-staged versions of each are being processed by our pipeline; you'll receive a follow-up email with the staged set + zip download once they're ready.</mj-text>
    </mj-column></mj-section>
    ${columns}
    <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
      <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
      <mj-text font-size="12px" color="#64748b" line-height="1.6">Source: original Zillow listing photos. NAR-compliant disclosure will be stamped on every staged version.</mj-text>
    </mj-column></mj-section>
  </mj-body></mjml>`;

  const text = `Photos for ${listing.address}\n\n${photos.length} listing photos attached. Virtually-staged versions coming next.\n\nSource photos:\n${photos.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n— Realscale`;

  const sendResult = await sendComplianceEmail({
    to: email,
    fromDomain,
    subject: `Photos for ${addr}`,
    mjml,
    text,
    listingId: listing.id,
    idempotencyKey: `send-photos-${listingId}-${email}`,
  });

  return NextResponse.json({
    ok: true,
    sent_to: email,
    listing: listing.address,
    photo_count: photos.length,
    resend_id: sendResult.id,
  });
}
