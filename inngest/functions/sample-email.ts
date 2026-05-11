/**
 * Listens for `preview/ready` events. If the listing has a captured
 * visitor email (set when they submitted the URL via /api/self-serve
 * with their email at the /grade or /l/[slug] free-sample CTA), send
 * them a personal "your samples are ready" email with the 2 best
 * before/after pairs + a 10%-off promo code that auto-applies at
 * checkout.
 *
 * Why this exists: visitors who get a grader score but don't pay are
 * the bulk of the funnel. Currently they bounce and we have nothing.
 * With email capture + emailed samples, they get a tangible artifact,
 * we capture an email for follow-up, and the discount code measurably
 * improves the comeback rate (per the recovery email pattern that
 * already converts well in the cart-recovery watchdog).
 *
 * Idempotency: dedupe via a messages-table check — if there's already
 * an outbound message for this listing with the SAMPLE_SUBJECT_PREFIX,
 * skip. Belt-and-suspenders against multiple preview/ready firings
 * for the same listing (e.g. retargeting different services).
 */
import { inngest } from "@/inngest/client";
import { db, listings, previews, messages } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

const RESEND_KEY = env("RESEND_API_KEY");
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const REPLIES_EMAIL = env("REPLIES_EMAIL", `jack@${FROM_DOMAIN}`)!;

const SAMPLE_SUBJECT_PREFIX = "Your Restay samples are ready";

export const sampleEmailFn = inngest.createFunction(
  {
    id: "sample-email",
    name: "Send free-sample email when preview is ready",
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: "preview/ready" },
  async ({ event, step, logger }) => {
    const listingId = event.data.listingId as string;

    const ctx = await step.run("load-context", async () => {
      const [l] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!l) return null;
      const [p] = await db
        .select()
        .from(previews)
        .where(eq(previews.listingId, listingId))
        .orderBy(desc(previews.createdAt))
        .limit(1);
      return { listing: l, preview: p ?? null };
    });

    if (!ctx?.listing.selfServeEmail) {
      return { skipped: "no-email" };
    }
    if (!ctx.preview || ctx.preview.enhancedPhotoUrls.length === 0) {
      return { skipped: "no-preview" };
    }

    // Dedupe: if we already sent a sample email for this listing, skip.
    const dupe = await step.run("check-dedupe", async () => {
      const [existing] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.listingId, listingId),
            eq(messages.direction, "outbound"),
          ),
        );
      // We can't filter by subject prefix easily without a LIKE; cheap enough
      // to overfetch and check in JS.
      if (!existing) return false;
      const all = await db
        .select({ subject: messages.subject })
        .from(messages)
        .where(
          and(
            eq(messages.listingId, listingId),
            eq(messages.direction, "outbound"),
          ),
        );
      return all.some((m) => (m.subject ?? "").startsWith(SAMPLE_SUBJECT_PREFIX));
    });
    if (dupe) {
      logger.info(`Sample email already sent for ${listingId} — skipping`);
      return { skipped: "already-sent" };
    }

    const result = await step.run("send-email", async () => {
      // ─── 1. Mint a 10%-off code, 7-day TTL ─────────────────────────
      const expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400;
      const codeStr = `SAMPLES${Math.floor(Math.random() * 9000) + 1000}`;
      const coupon = await stripe.coupons.create({
        percent_off: 10,
        duration: "once",
        name: `Sample-email follow-up — listing ${listingId.slice(0, 8)}`,
        redeem_by: expiresAt,
        max_redemptions: 1,
        metadata: { source: "sample_email", listingId },
      });
      await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: codeStr,
        expires_at: expiresAt,
        max_redemptions: 1,
        metadata: { source: "sample_email", listingId },
      });

      // ─── 2. Build the email ────────────────────────────────────────
      const l = ctx.listing;
      const p = ctx.preview!;
      const before = p.originalPhotoUrls.slice(0, 2);
      const after = p.enhancedPhotoUrls.slice(0, 2);
      const firstName = l.agentName ? l.agentName.split(/\s+/)[0] : null;
      const greeting = firstName ? `Hey ${firstName},` : "Hey,";
      const market = [l.city, l.state].filter(Boolean).join(", ");
      const listingRef = l.scrapedTitle ?? (market ? `your ${market} listing` : "your listing");
      const checkoutUrl = `${APP_URL}/l/${l.slug}?promo=${codeStr}`;
      const subject = `${SAMPLE_SUBJECT_PREFIX} — ${listingRef.slice(0, 60)}`;

      const text = `${greeting}

Here are 2 photos from ${listingRef} restyled by our pipeline — same shots you posted on Airbnb, just relit, decluttered, and color-graded. No furniture added or removed.

Photo 1 (before / after):
  ${before[0] ?? ""}
  ${after[0] ?? ""}

Photo 2 (before / after):
  ${before[1] ?? ""}
  ${after[1] ?? ""}

If you like the look, the full Tune-Up rewrites your title + description, restyles 10 photos, and ships a 30-day pricing report — all delivered in under 4 hours. Code ${codeStr} takes 10% off (expires in 7 days).

  Finish here (discount auto-applies): ${checkoutUrl}

Or reply to this email with any question — I see every reply personally. If you want a specific angle prioritized (lead with the kitchen, downplay the basement, etc.), just say so.

— Jack
Founder, Restay
${APP_URL}
`;

      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
<p>${greeting}</p>
<p>Here are 2 photos from ${listingRef} restyled by our pipeline — same shots you posted on Airbnb, just relit, decluttered, and color-graded. No furniture added or removed.</p>
${[0, 1]
  .map((i) =>
    before[i] && after[i]
      ? `<table style="width:100%;border-collapse:collapse;margin:18px 0;"><tr>
<td style="width:50%;padding-right:6px;vertical-align:top;">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;margin-bottom:4px;">Before</div>
<img src="${before[i]}" alt="Before" style="width:100%;height:auto;border-radius:8px;display:block;"/>
</td>
<td style="width:50%;padding-left:6px;vertical-align:top;">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#0f766e;font-weight:600;margin-bottom:4px;">After</div>
<img src="${after[i]}" alt="After" style="width:100%;height:auto;border-radius:8px;display:block;"/>
</td>
</tr></table>`
      : "",
  )
  .join("")}
<table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;background:#f8fafc;width:100%;margin:14px 0;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;">Discount code</div>
<div style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;font-size:18px;font-weight:700;letter-spacing:0.05em;color:#0f172a;margin-top:4px;">${codeStr}</div>
<div style="font-size:13px;color:#475569;margin-top:8px;">10% off the full Tune-Up. <strong>Expires in 7 days.</strong></div>
<div style="margin-top:12px;"><a href="${checkoutUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">See the full Tune-Up →</a></div>
</td></tr>
</table>
<p>Reply to this email with any question — I see every reply personally. Want a specific angle prioritized (lead with the kitchen, downplay the basement, etc.)? Just say so.</p>
<p>— Jack<br/>Founder, Restay<br/><a href="${APP_URL}" style="color:#475569;">restay.agency</a></p>
</body></html>`;

      // ─── 3. Send + log ─────────────────────────────────────────────
      if (!resend) {
        logger.warn(`[sample-email] no RESEND_API_KEY — would send to ${l.selfServeEmail}`);
        return { skipped: "no-resend-key" };
      }
      const send = await resend.emails.send({
        from: `Jack at Restay <jack@${FROM_DOMAIN}>`,
        to: l.selfServeEmail!,
        replyTo: REPLIES_EMAIL,
        subject,
        text,
        html,
        headers: { "Idempotency-Key": `sample-${listingId}` },
        tags: [
          { name: "type", value: "sample_email" },
        ],
      });
      if (send.error) throw new Error(`Resend sample-email error: ${send.error.message}`);

      await db.insert(messages).values({
        listingId,
        direction: "outbound",
        from: `jack@${FROM_DOMAIN}`,
        to: l.selfServeEmail!,
        subject,
        bodyText: text,
        bodyHtml: html,
        aiReplyGenerated: false,
      });
      return { sent: true, resendId: send.data?.id ?? null, codeStr };
    });

    return result;
  },
);
