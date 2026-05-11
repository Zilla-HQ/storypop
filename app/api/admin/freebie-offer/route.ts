import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings, previews, outreachEvents } from "@/db";
import { eq, sql } from "drizzle-orm";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { shortAddress } from "@/lib/utils";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const TEMPLATE_ID = "freebie_offer_v1";

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
 * Free-first-listing offer to clickers — the unblock for day-1 SaaS.
 * Cold blasts at 50% off won't convert without social proof. The play:
 * offer the first listing fully free in exchange for one line of
 * feedback (a testimonial we can use). Day-1 conversions THEN unblock
 * all future paid conversions.
 *
 * Targets: listings whose recipient has CLICKED a prior cold email but
 * has not paid AND has not yet received the freebie offer. ~17
 * candidates as of right now.
 *
 *   POST /api/admin/freebie-offer
 *   ?dry=1 for count-only
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";

  const targets = (await db.execute(sql`
    SELECT DISTINCT ON (l.id)
                    l.id, l.address, l.slug, l.agent_email, l.agent_name,
                    p.id as preview_id
    FROM relist.listings l
    JOIN relist.previews p ON p.listing_id = l.id AND p.service_id = 'photo-staging'
    WHERE l.agent_email IS NOT NULL AND l.agent_email != ''
      AND EXISTS (
        SELECT 1 FROM relist.outreach_events e
        WHERE e.listing_id = l.id
          AND e.channel = 'email'
          AND (e.first_clicked_at IS NOT NULL OR e.replied_at IS NOT NULL)
      )
      AND NOT EXISTS (
        SELECT 1 FROM relist.outreach_events e2
        WHERE e2.listing_id = l.id AND e2.template_id = ${TEMPLATE_ID}
      )
      AND NOT EXISTS (
        SELECT 1 FROM relist.orders o
        WHERE o.listing_id = l.id AND o.status IN ('paid', 'fulfilled', 'fulfilling')
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
  }>;

  if (dry) {
    return NextResponse.json({ dry: true, target_count: targets.length, template_id: TEMPLATE_ID });
  }

  const settings = await getSettings();
  const blacklist = new Set(settings.emailBlacklist.map((e) => e.toLowerCase()));
  const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const t of targets) {
    const email = t.agent_email.toLowerCase();
    if (blacklist.has(email)) {
      skipped += 1;
      continue;
    }

    const firstName = (t.agent_name ?? "there").split(" ")[0];
    const addr = shortAddress(t.address);
    const previewImg = `${appUrl}/api/img/${t.preview_id}?i=0&kind=after`;
    // The "free" link uses a 100%-off code we'll create separately,
    // OR Stripe is bypassed entirely if Jack manually fulfills. For
    // simplicity, the email asks them to REPLY YES — Jack handles fulfillment
    // out of band on the first ones to bootstrap testimonials.
    const replyEmail = env("REPLIES_EMAIL", "replies@realscale.app");

    const subject = `${addr} — I'll do this one free in exchange for one line of feedback`;
    const bodyText = `Hey ${firstName},

I'm trying to get my first 5 paid agents on Realscale and you're one of the people who clicked my email earlier — so here's a straight trade.

I'll deliver the full Standard package on ${addr} (12-15 staged interior photos, NAR-disclosure stamped, under 2 hours) — completely free. The only thing I ask in return: if you like the work, send me one sentence of feedback I can put on the site as a testimonial.

That's it. Reply "YES" to this email and I'll start the order. Whole thing is on me, no card needed, no commitment.

Trying to get to 5 testimonials by end of week. You'd be agent #1 or #2.

— Jack
Realscale`;

    const bodyMjml = `<mjml><mj-body background-color="#f4f5f7">
      <mj-section padding="24px 0 8px"><mj-column>
        <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="32px 32px 8px"><mj-column>
        <mj-text font-size="16px" line-height="1.6">Hey ${escapeHtml(firstName)},</mj-text>
        <mj-text font-size="16px" line-height="1.6">I'm trying to get my first 5 paid agents on Realscale and you're one of the people who clicked my email earlier — so here's a straight trade.</mj-text>
        <mj-text font-size="16px" line-height="1.6"><b>I'll deliver the full Standard package on ${escapeHtml(addr)}</b> (12-15 staged interior photos, NAR-disclosure stamped, under 2 hours) — <b>completely free</b>. The only thing I ask in return: if you like the work, one sentence of feedback I can use as a testimonial.</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="20px 16px 0"><mj-column>
        <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">YOUR PREVIEW — ALREADY GENERATED</mj-text>
        <mj-image src="${previewImg}" alt="Realscale preview for ${escapeHtml(addr)}" border-radius="10px" padding="0"/>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="20px 32px"><mj-column>
        <mj-text font-size="16px" line-height="1.6">Reply <b>"YES"</b> to this email and I'll start the order. No card needed, no commitment.</mj-text>
        <mj-text font-size="14px" color="#475569" line-height="1.5">Trying to hit 5 testimonials by end of week. You'd be agent #1 or #2.</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="#ffffff" padding="0 32px 24px" border-radius="0 0 14px 14px"><mj-column>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="14px 0"/>
        <mj-text font-size="12px" color="#64748b" line-height="1.6">
          — Jack<br/>
          Founder, Realscale<br/>
          <a href="mailto:${replyEmail}" style="color:#64748b">${replyEmail}</a>
        </mj-text>
      </mj-column></mj-section>
    </mj-body></mjml>`;

    try {
      const [evt] = await db
        .insert(outreachEvents)
        .values({
          listingId: t.id,
          channel: "email",
          templateId: TEMPLATE_ID,
          senderDomain: fromDomain,
          subject,
          body: bodyText,
          status: "queued",
        })
        .returning();

      const result = await sendComplianceEmail({
        to: t.agent_email,
        fromDomain: pickSenderDomain(settings.senderDomains, sent),
        subject,
        mjml: bodyMjml,
        text: bodyText,
        listingId: t.id,
        idempotencyKey: `${TEMPLATE_ID}_${t.id}`,
        tags: [
          { name: "agent", value: "outreach" },
          { name: "template", value: TEMPLATE_ID },
          { name: "listing_id", value: t.id },
        ],
      });

      await db
        .update(outreachEvents)
        .set({ resendId: result.id, status: "sent", sentAt: new Date() })
        .where(eq(outreachEvents.id, evt.id));

      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${t.agent_email}: ${msg.slice(0, 200)}`);
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
