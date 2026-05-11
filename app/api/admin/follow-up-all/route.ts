import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings, previews, outreachEvents } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { uploadToR2, signedR2Url } from "@/lib/r2";
import { generateStagedPreview } from "@/lib/falai";
import { applyTextWatermark } from "@/lib/watermark";
import { pickBestForStaging } from "@/lib/room-classify";
import { getSettings } from "@/db/settings";
import { shortAddress, formatCents } from "@/lib/utils";
import { env } from "@/lib/env";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Re-send every existing cold-email recipient using the new pay-on-intent
 * format (stock before/after sample + recipient's own listing photo + CTA
 * that leads to /l/<slug> where the personalized preview is generated on
 * click).
 *
 * Filters out:
 *   - blacklisted addresses (the realtor.com / mlsgrid.com batch we caught earlier)
 *   - listings that already received a v2 follow-up (idempotent re-runs)
 *
 *   POST /api/admin/follow-up-all
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  const blacklist = new Set(settings.emailBlacklist.map((e) => e.toLowerCase()));

  // Distinct listings that received any prior outreach AND have a valid
  // agent_email AND haven't received a v2 follow-up yet. Two-step query:
  // SELECT DISTINCT can't be used with the photos JSONB column, so we get
  // distinct listing IDs first, then fetch full rows for those IDs.
  const idRows = (await db.execute(sql`
    select distinct e.listing_id as id
    from relist.outreach_events e
    where e.template_id in ('outreach_v1', 'homeowner_outreach_v1')
      and not exists (
        select 1 from relist.outreach_events e2
        where e2.listing_id = e.listing_id and e2.template_id = 'followup_v9_stride_sample'
      )
  `)) as unknown as Array<{ id: string }>;
  const targetIds = idRows.map((r) => r.id);

  const rows = targetIds.length > 0
    ? await db
        .select({
          id: listings.id,
          address: listings.address,
          slug: listings.slug,
          agent_email: listings.agentEmail,
          agent_name: listings.agentName,
          photos: listings.photos,
        })
        .from(listings)
        .where(
          sql`${listings.id} in ${sql.raw(`('${targetIds.join("','")}')`)} and ${listings.agentEmail} is not null`,
        )
    : [];

  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
  const price = formatCents(settings.pricingStandardCents);

  let sent = 0;
  let skipped = 0;
  let skippedNoPreview = 0;
  const errors: string[] = [];

  for (const r of rows) {
    if (!r.agent_email) {
      skipped += 1;
      continue;
    }
    const email = r.agent_email.toLowerCase();
    if (blacklist.has(email)) {
      skipped += 1;
      continue;
    }

    // Look for existing preview pairs. We want TWO before/afters per email
    // (one staged, one enhanced when possible). Only accept previews whose
    // originals are real Zillow photos — reject any leftover Unsplash /
    // placeholder URLs.
    const [existingPreview] = await db
      .select()
      .from(previews)
      .where(and(eq(previews.listingId, r.id), eq(previews.serviceId, "photo-staging")))
      .orderBy(desc(previews.createdAt))
      .limit(1);

    const isUntrustedUrl = (u: string | undefined) =>
      !u ||
      u.includes("unsplash.com") ||
      u.includes("placehold") ||
      !u.includes("zillowstatic.com");

    type Pair = { before: string; after: string; mode: "staging" | "enhancement" };
    const pairs: Pair[] = [];

    if (
      existingPreview &&
      existingPreview.originalPhotoUrls.length > 0 &&
      existingPreview.enhancedPhotoUrls.length > 0 &&
      !isUntrustedUrl(existingPreview.originalPhotoUrls[0])
    ) {
      // Use existing pair[0] if trustworthy
      pairs.push({
        before: existingPreview.originalPhotoUrls[0],
        after: existingPreview.enhancedPhotoUrls[0],
        mode: "enhancement",
      });
      if (
        existingPreview.originalPhotoUrls.length > 1 &&
        existingPreview.enhancedPhotoUrls.length > 1 &&
        !isUntrustedUrl(existingPreview.originalPhotoUrls[1])
      ) {
        pairs.push({
          before: existingPreview.originalPhotoUrls[1],
          after: existingPreview.enhancedPhotoUrls[1],
          mode: "staging",
        });
      }
    }

    // If we don't have 2 valid pairs, generate fresh ones from the listing's
    // own MLS photos. Pick top 2 via the classifier — empty rooms first
    // (staging mode) then furnished (enhancement mode).
    if (pairs.length < 2 && r.photos && r.photos.length > 0) {
      try {
        const ranked = await pickBestForStaging(r.photos, 2 - pairs.length);
        for (let idx = 0; idx < ranked.length; idx++) {
          const sourceUrl = ranked[idx].url;
          const isEmpty = ranked[idx].classification.empty;
          const mode: "staging" | "enhancement" = isEmpty ? "staging" : "enhancement";
          // Mirror to R2 so fal.ai can fetch it (Zillow CDN sometimes 403s)
          const sRes = await fetch(sourceUrl);
          if (!sRes.ok) continue;
          const sBuf = Buffer.from(await sRes.arrayBuffer());
          const slot = pairs.length;
          const sKey = `previews/${r.id}/source-${slot}.jpg`;
          await uploadToR2(sKey, sBuf, "image/jpeg");
          const sR2 = await signedR2Url(sKey, 3600);
          const result = await generateStagedPreview({
            sourceImageUrl: sR2,
            styleFragment:
              "modern contemporary interior, clean lines, neutral palette, natural light, minimalist furniture",
            roomHint: ranked[idx].classification.kind,
            mode,
          });
          const oRes = await fetch(result.url);
          const oBuf = Buffer.from(await oRes.arrayBuffer());
          const stamped = await applyTextWatermark(
            oBuf,
            mode === "staging" ? "Virtually Staged" : "Enhanced",
            { position: "bottom-left", opacity: 0.7 },
          );
          const oKey = `previews/${r.id}/photo-staging-${slot}.jpg`;
          await uploadToR2(oKey, stamped, "image/jpeg");
          const enhancedSignedUrl = await signedR2Url(oKey, 60 * 60 * 24 * 7);
          pairs.push({ before: sourceUrl, after: enhancedSignedUrl, mode });
        }
        // Persist for the /l/<slug> page (replace any earlier corrupted row)
        if (pairs.length > 0) {
          await db
            .delete(previews)
            .where(and(eq(previews.listingId, r.id), eq(previews.serviceId, "photo-staging")));
          await db.insert(previews).values({
            listingId: r.id,
            serviceId: "photo-staging",
            originalPhotoUrls: pairs.map((p) => p.before),
            enhancedPhotoUrls: pairs.map((p) => p.after),
            stylePreset: "modern",
            costCents: 6 * pairs.length,
          });
        }
      } catch (e) {
        errors.push(`preview-gen ${r.address}: ${(e as Error).message}`);
      }
    }

    if (pairs.length === 0) {
      skippedNoPreview += 1;
      continue;
    }

    // Order: enhancement first, staging second (for visual flow in the email)
    pairs.sort((a, b) => (a.mode === "enhancement" ? -1 : 1));
    const enhancedPair = pairs.find((p) => p.mode === "enhancement");
    const stagedPair = pairs.find((p) => p.mode === "staging");
    // If we have ONLY enhancement pairs (no empty rooms), use the second
    // enhancement as the second slot. If only one pair exists, the email
    // still goes out with just that single pair.
    const pair1 = enhancedPair ?? pairs[0];
    const pair2 = stagedPair ?? (pairs[1] !== pair1 ? pairs[1] : null);

    const firstName = (r.agent_name ?? "there").split(" ")[0];
    const addr = shortAddress(r.address);
    const checkoutLink = `${appUrl}/l/${r.slug}`;
    const subject = `Quick follow-up: ${addr} enhanced + staged photos`;
    const enhanceLabel = "Enhanced (lighting + color retouch)";
    const stageLabel = "Virtually Staged (furniture added to empty room)";
    const bodyText = `Hey ${firstName},

Following up on ${addr} — here's two real before/afters we generated from your actual MLS listing photos. One is a professional retouch (brighter, sharper, magazine-style); the other is a virtual staging of an empty room.

Click below to see the full preview and order the complete set.

${checkoutLink}

— Realscale`;

    const pair2Section = pair2
      ? `<mj-section background-color="#ffffff" padding="0 16px">
          <mj-column padding="0 6px">
            <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">BEFORE — YOUR LISTING</mj-text>
            <mj-image src="${pair2.before}" alt="Before — ${escapeHtml(addr)}" border-radius="10px" padding="0"/>
          </mj-column>
          <mj-column padding="0 6px">
            <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#047857" padding="0 0 6px">${pair2.mode === "staging" ? "VIRTUALLY STAGED" : "ENHANCED"}</mj-text>
            <mj-image src="${pair2.after}" alt="After — ${pair2.mode}" border-radius="10px" padding="0"/>
          </mj-column>
        </mj-section>
        <mj-section background-color="#ffffff" padding="0 32px 4px"><mj-column>
          <mj-text font-size="13px" color="#475569" padding="0 0 12px">${pair2.mode === "staging" ? stageLabel : enhanceLabel}</mj-text>
        </mj-column></mj-section>`
      : "";

    const bodyMjml = `<mjml><mj-body background-color="#f4f5f7">
      <mj-section padding="24px 0 8px"><mj-column>
        <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="32px 32px 8px" border-radius="14px 14px 0 0"><mj-column>
        <mj-text font-size="16px" line-height="1.6">Hey ${escapeHtml(firstName)},</mj-text>
        <mj-text font-size="16px" line-height="1.6">Following up on <b>${escapeHtml(addr)}</b> — here's two real before/afters we ran on your actual MLS photos.</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="8px 16px 0">
        <mj-column padding="0 6px">
          <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">BEFORE — YOUR LISTING</mj-text>
          <mj-image src="${pair1.before}" alt="Before — ${escapeHtml(addr)}" border-radius="10px" padding="0"/>
        </mj-column>
        <mj-column padding="0 6px">
          <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#047857" padding="0 0 6px">${pair1.mode === "staging" ? "VIRTUALLY STAGED" : "ENHANCED"}</mj-text>
          <mj-image src="${pair1.after}" alt="After — ${pair1.mode}" border-radius="10px" padding="0"/>
        </mj-column>
      </mj-section>
      <mj-section background-color="#ffffff" padding="0 32px 4px"><mj-column>
        <mj-text font-size="13px" color="#475569" padding="0 0 12px">${pair1.mode === "staging" ? stageLabel : enhanceLabel}</mj-text>
      </mj-column></mj-section>
      ${pair2Section}
      <mj-section background-color="#ffffff" padding="20px 32px 12px"><mj-column>
        <mj-button href="${checkoutLink}" background-color="#111827" color="#ffffff" font-size="15px" font-weight="600" padding="6px 0 4px" inner-padding="14px 28px" border-radius="8px" align="left">
          See my personalized preview →
        </mj-button>
        <mj-text font-size="13px" color="#64748b" padding="6px 0 0">
          Free preview · Full set of enhanced photos delivered in under 2 hours for ${price}
        </mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
        <mj-text font-size="12px" color="#64748b" line-height="1.6">
          ✓ NAR-compliant disclosure on every photo<br/>
          ✓ Full refund within 14 days<br/>
          ✓ No signup required to see the preview
        </mj-text>
      </mj-column></mj-section>
    </mj-body></mjml>`;

    try {
      const [evt] = await db
        .insert(outreachEvents)
        .values({
          listingId: r.id,
          channel: "email",
          templateId: "followup_v9_stride_sample",
          senderDomain: fromDomain,
          subject,
          body: bodyText,
          status: "queued",
        })
        .returning();

      const result = await sendComplianceEmail({
        to: r.agent_email,
        fromDomain: pickSenderDomain(settings.senderDomains, sent),
        subject,
        mjml: bodyMjml,
        text: bodyText,
        listingId: r.id,
        idempotencyKey: `followup_v2_${r.id}_${evt.id}`,
        tags: [
          { name: "agent", value: "outreach" },
          { name: "template", value: "followup_v9_stride_sample" },
          { name: "listing_id", value: r.id },
        ],
      });

      await db
        .update(outreachEvents)
        .set({ resendId: result.id, status: "sent", sentAt: new Date() })
        .where(eq(outreachEvents.id, evt.id));

      sent += 1;
    } catch (e) {
      errors.push(`${r.agent_email}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: rows.length,
    sent,
    skipped_blacklist: skipped,
    skipped_no_preview: skippedNoPreview,
    errors: errors.slice(0, 10),
  });
}
