import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { timingSafeEqual } from "crypto";
import { db, listings, previews, outreachEvents } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { draftOutreachEmail } from "@/lib/claude";
import { sendComplianceEmail } from "@/lib/resend";
import { signedR2Url } from "@/lib/r2";
import { getSettings } from "@/db/settings";
import { shortAddress, formatCents } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Send the standard "first-touch" cold-outreach email for a listing to a
 * specific recipient — the same email a realtor would normally receive
 * (Subject "Your listing at X — before/after inside", side-by-side
 * before/after, CTA to checkout). Synthesizes the before image from the
 * listing's first photo, the after from an existing enhanced sample in
 * R2 if no real preview exists.
 *
 *   POST /api/admin/cold-email?listingId=<uuid>&email=<recipient>
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  const email = url.searchParams.get("email");
  if (!listingId || !email) {
    return NextResponse.json({ error: "?listingId + ?email required" }, { status: 400 });
  }

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  // Before image: first listing photo (Zillow CDN works fine in email clients).
  const before = listing.photos?.[0];
  if (!before) return NextResponse.json({ error: "listing has no photos" }, { status: 400 });

  // After image: prefer a REAL photo-staging preview of this exact listing
  // (what a recipient would expect — their own room enhanced, not a stock
  // sample). Falls back to the website's photo-staging demo only if no
  // photo-staging-specific preview exists for this listing yet.
  const [photoStagingPreview] = await db
    .select()
    .from(previews)
    .where(and(eq(previews.listingId, listingId), eq(previews.serviceId, "photo-staging")))
    .orderBy(desc(previews.createdAt))
    .limit(1);
  let after: string;
  let usedRealPreview = false;
  if (
    photoStagingPreview?.enhancedPhotoUrls &&
    photoStagingPreview.enhancedPhotoUrls.length > 0
  ) {
    after = photoStagingPreview.enhancedPhotoUrls[0];
    usedRealPreview = true;
  } else {
    after = await signedR2Url("samples/services/photo-staging-after.jpg", 60 * 60 * 24 * 7);
  }
  // Also pick the matching original (so before/after are the same room)
  let before2 = before;
  if (
    photoStagingPreview?.originalPhotoUrls &&
    photoStagingPreview.originalPhotoUrls.length > 0
  ) {
    before2 = photoStagingPreview.originalPhotoUrls[0];
  }

  const settings = await getSettings();
  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
  const checkoutLink = `${appUrl}/l/${listing.slug}`;
  const agentFirstName = (listing.agentName ?? "there").split(" ")[0];

  const drafted = await draftOutreachEmail({
    agentFirstName,
    shortAddress: shortAddress(listing.address),
    photoCount: listing.photos.length,
    checkoutLink,
    beforeUrl: before2,
    afterUrl: after,
    price: formatCents(settings.pricingStandardCents),
  });

  // Pre-record the outreach event so it shows in /admin/outreach with the
  // full thread tracking; status flips to 'sent' once Resend acknowledges.
  const [evt] = await db
    .insert(outreachEvents)
    .values({
      listingId: listing.id,
      channel: "email",
      templateId: "outreach_v1",
      senderDomain: fromDomain,
      subject: drafted.subject,
      body: drafted.bodyText,
      status: "queued",
    })
    .returning();

  const sendResult = await sendComplianceEmail({
    to: email,
    fromDomain,
    subject: drafted.subject,
    mjml: drafted.bodyMjml,
    text: drafted.bodyText,
    listingId: listing.id,
    idempotencyKey: `cold-email-${listingId}-${email}-${evt.id}`,
    tags: [
      { name: "agent", value: "outreach" },
      { name: "listing_id", value: listingId },
      { name: "ad_hoc", value: "true" },
    ],
  });

  await db
    .update(outreachEvents)
    .set({ resendId: sendResult.id, status: "sent", sentAt: new Date() })
    .where(eq(outreachEvents.id, evt.id));

  return NextResponse.json({
    ok: true,
    sent_to: email,
    listing: listing.address,
    subject: drafted.subject,
    checkout_link: checkoutLink,
    used_real_preview: usedRealPreview,
    resend_id: sendResult.id,
    outreach_event_id: evt.id,
  });
}
