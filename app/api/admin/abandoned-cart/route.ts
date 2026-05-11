import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings, previews, orders, outreachEvents } from "@/db";
import { eq, sql, and } from "drizzle-orm";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { shortAddress, formatCents } from "@/lib/utils";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const TEMPLATE_ID = "abandoned_cart_recovery_v1";

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
 * Abandoned-cart recovery — email everyone who reached the Stripe
 * checkout step (created an order row) but didn't actually pay. These
 * are dramatically hotter than cold leads — they already saw the
 * product, the price, and chose to click.
 *
 * Recovery email:
 *  - Personal-feeling apology (assumes they got distracted / signal cut)
 *  - LAUNCH50 promo pre-applied to a fresh /l/<slug> link
 *  - Live preview image (via /api/img proxy — never expires)
 *  - Idempotent: skips orders we've already recovery-emailed
 *
 *   POST /api/admin/abandoned-cart
 *   ?dry=1 for count-only
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";

  // Pending orders older than 30 minutes (give the user a chance to
  // come back themselves) and younger than 14 days (older = stale,
  // listing context probably gone). For each, we'll email either the
  // customer_email if Stripe captured one, or fall back to the
  // listing's agent_email.
  const targets = (await db.execute(sql`
    SELECT o.id as order_id,
           o.listing_id,
           o.tier,
           o.amount_cents,
           o.customer_email,
           o.created_at as order_created_at,
           l.address,
           l.slug,
           l.agent_email,
           l.agent_name,
           p.id as preview_id
    FROM relist.orders o
    JOIN relist.listings l ON l.id = o.listing_id
    LEFT JOIN LATERAL (
      SELECT id FROM relist.previews
      WHERE listing_id = o.listing_id AND service_id = 'photo-staging'
      ORDER BY created_at DESC
      LIMIT 1
    ) p ON true
    WHERE o.status = 'pending'
      AND o.created_at < now() - interval '30 minutes'
      AND o.created_at > now() - interval '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM relist.outreach_events e
        WHERE e.listing_id = o.listing_id
          AND e.template_id = ${TEMPLATE_ID}
      )
  `)) as unknown as Array<{
    order_id: string;
    listing_id: string;
    tier: "standard" | "premium" | "rush";
    amount_cents: number;
    customer_email: string | null;
    order_created_at: Date;
    address: string;
    slug: string;
    agent_email: string | null;
    agent_name: string | null;
    preview_id: string | null;
  }>;

  if (dry) {
    return NextResponse.json({
      dry: true,
      target_count: targets.length,
      template_id: TEMPLATE_ID,
    });
  }

  const settings = await getSettings();
  const blacklist = new Set(settings.emailBlacklist.map((e) => e.toLowerCase()));
  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const t of targets) {
    const recipient = (t.customer_email ?? t.agent_email ?? "").toLowerCase();
    if (!recipient || blacklist.has(recipient)) {
      skipped += 1;
      continue;
    }

    const firstName = (t.agent_name ?? "there").split(" ")[0];
    const addr = shortAddress(t.address);
    const fullPrice = formatCents(t.amount_cents);
    const discountedPrice = formatCents(Math.round(t.amount_cents * 0.5));
    const checkoutLink = `${appUrl}/l/${t.slug}?code=LAUNCH50&utm_source=email&utm_campaign=abandoned_cart`;
    const previewImg = t.preview_id
      ? `${appUrl}/api/img/${t.preview_id}?i=0&kind=after`
      : null;

    const subject = `Looks like ${addr} didn't finish checkout — 50% off if you come back`;
    const bodyText = `Hey ${firstName},

Saw you started checkout on ${addr}'s ${t.tier} package and didn't finish. No pressure — but if it was a price thing, here's 50% off (code LAUNCH50, expires soon):

  ${t.tier} package:    ${fullPrice}  →  ${discountedPrice}

Same listing, same preview I generated for you, NAR-disclosure stamped, under 2-hour delivery, 14-day refund. Pick up where you left off:

${checkoutLink}

— Jack
Realscale`;

    const previewMjml = previewImg
      ? `<mj-section background-color="#ffffff" padding="20px 16px 8px"><mj-column>
          <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">YOUR PREVIEW — STILL READY</mj-text>
          <mj-image src="${previewImg}" alt="Realscale preview for ${escapeHtml(addr)}" border-radius="10px" padding="0"/>
        </mj-column></mj-section>`
      : "";

    const bodyMjml = `<mjml><mj-body background-color="#f4f5f7">
      <mj-section padding="24px 0 8px"><mj-column>
        <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#fef3c7" padding="14px 32px"><mj-column>
        <mj-text align="center" font-size="14px" font-weight="700" color="#92400e">⏱ Cart recovery — 50% off with code LAUNCH50</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="32px 32px 8px"><mj-column>
        <mj-text font-size="16px" line-height="1.6">Hey ${escapeHtml(firstName)},</mj-text>
        <mj-text font-size="16px" line-height="1.6">Saw you started checkout on <b>${escapeHtml(addr)}</b>'s ${escapeHtml(t.tier)} package and didn't finish. No pressure — but if it was a price thing, here's <b>50% off</b> the same package:</mj-text>
      </mj-column></mj-section>
      ${previewMjml}
      <mj-section background-color="#ffffff" padding="20px 32px 4px"><mj-column>
        <mj-text font-size="14px" color="#1f2937"><span style="color:#9ca3af;text-decoration:line-through">${escapeHtml(fullPrice)}</span> → <b style="color:#047857">${escapeHtml(discountedPrice)}</b> with code <b>LAUNCH50</b></mj-text>
        <mj-text font-size="13px" color="#475569" padding="2px 0 0">Same listing, same preview, NAR-disclosure stamped, under 2-hour delivery.</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="14px 32px 12px"><mj-column>
        <mj-button href="${checkoutLink}" background-color="#047857" color="#ffffff" font-size="15px" font-weight="700" padding="6px 0 4px" inner-padding="16px 30px" border-radius="8px" align="left">
          Pick up where you left off — ${escapeHtml(discountedPrice)} →
        </mj-button>
        <mj-text font-size="12px" color="#64748b" padding="8px 0 0">Code auto-applies. Expires within 24 hours.</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
        <mj-text font-size="12px" color="#64748b" line-height="1.6">
          ✓ 14-day full refund<br/>
          ✓ NAR-compliant disclosure<br/>
          ✓ Under 2-hour delivery
        </mj-text>
      </mj-column></mj-section>
    </mj-body></mjml>`;

    try {
      const [evt] = await db
        .insert(outreachEvents)
        .values({
          listingId: t.listing_id,
          channel: "email",
          templateId: TEMPLATE_ID,
          senderDomain: fromDomain,
          subject,
          body: bodyText,
          status: "queued",
        })
        .returning();

      const result = await sendComplianceEmail({
        to: recipient,
        fromDomain: pickSenderDomain(settings.senderDomains, sent),
        subject,
        mjml: bodyMjml,
        text: bodyText,
        listingId: t.listing_id,
        idempotencyKey: `${TEMPLATE_ID}_${t.order_id}`,
        tags: [
          { name: "agent", value: "outreach" },
          { name: "template", value: TEMPLATE_ID },
          { name: "listing_id", value: t.listing_id },
          { name: "order_id", value: t.order_id },
        ],
      });

      await db
        .update(outreachEvents)
        .set({ resendId: result.id, status: "sent", sentAt: new Date() })
        .where(eq(outreachEvents.id, evt.id));

      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`order ${t.order_id} → ${recipient}: ${msg.slice(0, 200)}`);
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    target_count: targets.length,
    template_id: TEMPLATE_ID,
    error_count: errors.length,
    errors: errors.slice(0, 5),
  });
}
