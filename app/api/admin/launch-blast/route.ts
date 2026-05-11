import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings, previews, outreachEvents } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * One-shot 24h launch blast — re-engagement to every prior cold-email
 * recipient with their EXISTING preview, an urgency hook, and the
 * FOUNDING10 promo pre-applied via ?code=. No fresh fal.ai spend (reuses
 * stored previews); idempotent (skips anyone who already got the blast).
 *
 *   POST /api/admin/launch-blast
 *   Header: X-Trigger-Secret: <TRIGGER_SECRET>
 *   Optional ?dry=1 for a count-only dry run.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const PROMO = (url.searchParams.get("code") ?? env("OUTREACH_PROMO_CODE", "FOUNDING10"))!.toUpperCase();
  const PROMO_PCT = parseInt(
    url.searchParams.get("pct") ?? env("OUTREACH_PROMO_PCT", "10") ?? "10",
    10,
  );
  // Optional: tag this run as a "fix" re-send. Two flavors:
  //   ?fix=1         — apology for expired-URL broken images
  //   ?fix=watermark — apology for garbled-glyph watermark + LAUNCH50 upgrade
  const fixMode = url.searchParams.get("fix");
  const fix = fixMode === "1" || fixMode === "watermark";
  const fixWatermark = fixMode === "watermark";
  // Different template_id per promo code so each blast is idempotent
  // independently — letting us run a second wave with a stronger code
  // without double-mailing recipients of the first wave. The "_fix"
  // suffix lets us re-send working-images version even to people who
  // already got a broken-image version of the same promo.
  const TEMPLATE_ID = `launch_blast_${PROMO.toLowerCase()}_v1${fixWatermark ? "_fix_wm" : fix ? "_fix" : ""}`;
  // Audience: "engaged" = listings with prior outreach (re-engagement);
  // "fresh" = listings with previews but never previously emailed (fresh blast).
  // "all" = both. Default = "all" (max coverage).
  const audience = (url.searchParams.get("audience") ?? "all").toLowerCase();

  const settings = await getSettings();
  const blacklist = new Set(settings.emailBlacklist.map((e) => e.toLowerCase()));

  // Build the audience predicate dynamically so a single SQL query gathers
  // the right listings. All audiences share: has agent_email, has at least
  // one stored preview pair, hasn't already received THIS template.
  //
  //   "fresh"    — no prior cold-email outreach at all
  //   "engaged"  — has prior outreach
  //   "clickers" — clicked or replied to a prior cold email (hottest leads)
  //   "all"      — both
  const priorOutreachPredicate =
    audience === "fresh"
      ? sql`NOT EXISTS (SELECT 1 FROM relist.outreach_events e WHERE e.listing_id = l.id AND e.channel = 'email')`
      : audience === "engaged"
        ? sql`EXISTS (SELECT 1 FROM relist.outreach_events e WHERE e.listing_id = l.id AND e.channel = 'email')`
        : audience === "clickers"
          ? sql`EXISTS (SELECT 1 FROM relist.outreach_events e WHERE e.listing_id = l.id AND e.channel = 'email' AND (e.first_clicked_at IS NOT NULL OR e.replied_at IS NOT NULL))`
          : sql`true`;

  const targetRows = (await db.execute(sql`
    SELECT DISTINCT ON (l.id)
                    l.id, l.address, l.slug, l.agent_email, l.agent_name,
                    p.id as preview_id,
                    p.original_photo_urls, p.enhanced_photo_urls
    FROM relist.listings l
    JOIN relist.previews p ON p.listing_id = l.id AND p.service_id = 'photo-staging'
    WHERE l.agent_email IS NOT NULL AND l.agent_email != ''
      AND ${priorOutreachPredicate}
      AND NOT EXISTS (
        SELECT 1 FROM relist.outreach_events e2
        WHERE e2.listing_id = l.id AND e2.template_id = ${TEMPLATE_ID}
      )
      AND jsonb_array_length(p.original_photo_urls) > 0
      AND jsonb_array_length(p.enhanced_photo_urls) > 0
    ORDER BY l.id, p.created_at DESC
  `)) as unknown as Array<{
    id: string;
    address: string;
    slug: string;
    agent_email: string;
    agent_name: string | null;
    preview_id: string;
    original_photo_urls: string[];
    enhanced_photo_urls: string[];
  }>;

  if (dry) {
    return NextResponse.json({
      dry: true,
      target_count: targetRows.length,
      audience,
      promo: PROMO,
      promo_pct: PROMO_PCT,
      template_id: TEMPLATE_ID,
    });
  }

  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
  const fullPrice = formatCents(settings.pricingStandardCents);
  const discountedPrice = formatCents(
    Math.round(settings.pricingStandardCents * (1 - PROMO_PCT / 100)),
  );

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of targetRows) {
    const email = r.agent_email.toLowerCase();
    if (blacklist.has(email)) {
      skipped += 1;
      continue;
    }
    if (r.original_photo_urls.length === 0 || r.enhanced_photo_urls.length === 0) {
      skipped += 1;
      continue;
    }
    // ALWAYS use the stable proxy URLs for email images. Direct R2 signed
    // URLs expire after 7 days, breaking older emails. The proxy looks up
    // the R2 key at request time and 302s to a fresh signature on every fetch.
    const before = `${appUrl}/api/img/${r.preview_id}?i=0&kind=before`;
    const after = `${appUrl}/api/img/${r.preview_id}?i=0&kind=after`;

    const firstName = (r.agent_name ?? "there").split(" ")[0];
    const addr = shortAddress(r.address);
    const checkoutLink = `${appUrl}/l/${r.slug}?code=${PROMO}&utm_source=email&utm_campaign=launch_blast${fix ? "_fix" : ""}`;
    const subject = fixWatermark
      ? `Fixed the watermark on your ${addr} preview — bumped you to ${PROMO_PCT}% off`
      : fix
        ? `Quick fix: my last email's images broke — ${addr} preview inside (${PROMO_PCT}% off still active)`
        : `${addr} — your staged set, ${PROMO_PCT}% off (24 hours only)`;

    const apologyOpener = fixWatermark
      ? `Hey ${firstName} — turns out the watermark on the previews I sent earlier rendered as garbled glyphs (font fallback issue on the server, my mistake — looked janky/scammy). Just fixed every existing preview AND I'm bumping you up to ${PROMO_PCT}% off as an apology. Same listing, fixed photos:

`
      : fix
        ? `Hey ${firstName} — quick correction. The images in my email earlier today broke (R2 signed URLs expired, my fault). Here's the same offer with the actual preview I made for ${addr}:

`
        : "";
    const bodyText = `${apologyOpener}Hey ${firstName},

Doing a one-time launch promo today to get my first paying agents on Realscale. I'm taking ${PROMO_PCT}% off the full Standard package for the next 24 hours, no strings.

Your listing at ${addr} is queued — preview's already done (one example below). Full set is 12-15 photos, NAR-compliant, delivered under 2 hours.

  Standard:    ${fullPrice}  →  ${discountedPrice}  (with code ${PROMO})

Code expires in 24 hours. After that I'm pulling it.

${checkoutLink}

— Jack
Realscale (realscale.app)`;

    const bodyMjml = `<mjml><mj-body background-color="#f4f5f7">
      <mj-section padding="24px 0 8px"><mj-column>
        <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#fef3c7" padding="14px 32px"><mj-column>
        <mj-text align="center" font-size="14px" font-weight="700" color="#92400e">⏱ 24-hour launch promo · code ${escapeHtml(PROMO)} · ${PROMO_PCT}% off</mj-text>
      </mj-column></mj-section>
      ${
        fixWatermark
          ? `<mj-section background-color="#ffffff" padding="20px 32px 0"><mj-column>
        <mj-text font-size="14px" color="#475569" line-height="1.5">Honest correction — the watermark on the previews I sent earlier rendered as garbled glyphs (font fallback issue on my server). Looked janky/scammy. <b>Fixed every existing preview</b> and bumping you to ${PROMO_PCT}% off as an apology. Same listing, fixed photos:</mj-text>
      </mj-column></mj-section>`
          : fix
            ? `<mj-section background-color="#ffffff" padding="20px 32px 0"><mj-column>
        <mj-text font-size="14px" color="#475569" line-height="1.5">Quick correction — the images in my email earlier today broke (signed URLs expired, my fault). Same offer, here's the actual preview I made for your listing:</mj-text>
      </mj-column></mj-section>`
            : ""
      }
      <mj-section background-color="#ffffff" padding="${fix ? "20" : "32"}px 32px 8px" border-radius="0 0 0 0"><mj-column>
        <mj-text font-size="16px" line-height="1.6">Hey ${escapeHtml(firstName)},</mj-text>
        <mj-text font-size="16px" line-height="1.6">Doing a one-time launch promo today to get my first 100 paid agents. <b>${PROMO_PCT}% off</b> the Standard package for the next 24 hours, code <b>${escapeHtml(PROMO)}</b>. After that I'm pulling it.</mj-text>
        <mj-text font-size="16px" line-height="1.6">Your listing at <b>${escapeHtml(addr)}</b> is already queued — preview's done. Below is one of the photos I generated for it:</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="8px 16px 0">
        <mj-column padding="0 6px">
          <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">BEFORE — YOUR LISTING</mj-text>
          <mj-image src="${before}" alt="Before — ${escapeHtml(addr)}" border-radius="10px" padding="0"/>
        </mj-column>
        <mj-column padding="0 6px">
          <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#047857" padding="0 0 6px">REALSCALE OUTPUT</mj-text>
          <mj-image src="${after}" alt="After — Realscale output" border-radius="10px" padding="0"/>
        </mj-column>
      </mj-section>
      <mj-section background-color="#ffffff" padding="20px 32px 4px"><mj-column>
        <mj-text font-size="14px" color="#1f2937"><b>${escapeHtml(fullPrice)}</b> <span style="color:#9ca3af;text-decoration:line-through">${escapeHtml(fullPrice)}</span> → <b style="color:#047857">${escapeHtml(discountedPrice)}</b> with code <b>${escapeHtml(PROMO)}</b></mj-text>
        <mj-text font-size="13px" color="#475569" padding="2px 0 0">12-15 enhanced photos · under 2-hour delivery · NAR-compliant disclosure stamped</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="14px 32px 12px"><mj-column>
        <mj-button href="${checkoutLink}" background-color="#047857" color="#ffffff" font-size="15px" font-weight="700" padding="6px 0 4px" inner-padding="16px 30px" border-radius="8px" align="left">
          Get the full set — ${escapeHtml(discountedPrice)} →
        </mj-button>
        <mj-text font-size="12px" color="#64748b" padding="8px 0 0">Code auto-applies. Expires in 24 hours.</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
        <mj-text font-size="12px" color="#64748b" line-height="1.6">
          ✓ Full refund within 14 days<br/>
          ✓ NAR-compliant disclosure on every photo<br/>
          ✓ No signup required to see the full preview
        </mj-text>
      </mj-column></mj-section>
    </mj-body></mjml>`;

    try {
      const [evt] = await db
        .insert(outreachEvents)
        .values({
          listingId: r.id,
          channel: "email",
          templateId: TEMPLATE_ID,
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
        idempotencyKey: `${TEMPLATE_ID}_${r.id}`,
        tags: [
          { name: "agent", value: "outreach" },
          { name: "template", value: TEMPLATE_ID },
          { name: "listing_id", value: r.id },
        ],
      });

      await db
        .update(outreachEvents)
        .set({ resendId: result.id, status: "sent", sentAt: new Date() })
        .where(eq(outreachEvents.id, evt.id));

      sent += 1;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      errors.push(`${r.agent_email}: ${msg.slice(0, 200)}`);
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    audience,
    target_count: targetRows.length,
    template_id: TEMPLATE_ID,
    promo: PROMO,
    promo_pct: PROMO_PCT,
    error_count: errors.length,
    errors: errors.slice(0, 10),
  });
}
