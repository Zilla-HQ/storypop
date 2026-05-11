import { inngest } from "@/inngest/client";
import { db, orders, listings, messages } from "@/db";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { sendOpsAlert } from "@/lib/ops-alerts";

/**
 * Watchdog cron — every 10 minutes, find orders that:
 *   · are still status="pending" (never reached Stripe success page)
 *   · have a captured customer email (the visitor entered one at /l/[slug]
 *     before clicking the tier — see PersonalizedCheckout)
 *   · are between 30 min and 24 h old (younger = give them more time;
 *     older = Stripe Checkout session is expired, not worth chasing)
 *   · don't already have a `cart_recovery` message logged
 *
 * For each, mint a one-time 15%-off Stripe promotion code, send the
 * customer a personal "saw you bailed at checkout, here's a discount"
 * email, and log a row to messages so we never double-send.
 *
 * Ships because the Las Vegas customer on 2026-05-06 walked off Stripe
 * Checkout silently — we knew the listing URL, knew the price tier,
 * but had no email and zero way to follow up. Now /l/[slug] captures
 * email upfront so any future bail is recoverable.
 */

const STUCK_THRESHOLD_MIN = parseInt(env("PENDING_ORDER_THRESHOLD_MIN", "30") ?? "30", 10);
const STALE_AFTER_HOURS = parseInt(env("PENDING_ORDER_STALE_AFTER_HOURS", "24") ?? "24", 10);

const RESEND_KEY = env("RESEND_API_KEY");
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;
const SENDER_DOMAINS = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FROM_DOMAIN = SENDER_DOMAINS[0] ?? "mail.restay.agency";
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const REPLIES_EMAIL = env("REPLIES_EMAIL", `jack@${FROM_DOMAIN}`)!;

export const pendingOrderWatchdogFn = inngest.createFunction(
  {
    id: "pending-order-watchdog",
    name: "Watchdog — bailed-at-checkout cart recovery",
    concurrency: { limit: 1 },
  },
  { cron: "*/10 * * * *" },
  async ({ step, logger }) => {
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000);
    const staleCutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000);

    const candidates = await step.run("find-bailed-orders", async () => {
      // Anti-join against messages: only orders with NO existing
      // cart_recovery outbound message qualify. Subject prefix is the
      // dedupe handle since messages doesn't have a typed `kind` column.
      return await db
        .select({
          orderId: orders.id,
          listingId: orders.listingId,
          tier: orders.tier,
          amountCents: orders.amountCents,
          customerEmail: orders.customerEmail,
          createdAt: orders.createdAt,
          listingUrl: listings.listingUrl,
          listingSlug: listings.slug,
          scrapedTitle: listings.scrapedTitle,
          city: listings.city,
          state: listings.state,
          agentName: listings.agentName,
        })
        .from(orders)
        .innerJoin(listings, eq(orders.listingId, listings.id))
        .where(
          and(
            eq(orders.status, "pending"),
            isNotNull(orders.customerEmail),
            lt(orders.createdAt, stuckCutoff),
            sql`${orders.createdAt} > ${staleCutoff}`,
            sql`NOT EXISTS (
              SELECT 1 FROM ${messages} m
              WHERE m.order_id = ${orders.id}
                AND m.direction = 'outbound'
                AND m.subject LIKE 'Restay — your checkout%'
            )`,
          ),
        )
        .limit(20);
    });

    if (candidates.length === 0) {
      return { recovered: 0 };
    }

    logger.warn(`Sending cart-recovery to ${candidates.length} bailed checkout(s)`);

    let sent = 0;
    let failed = 0;

    for (const c of candidates) {
      if (!c.customerEmail) continue;
      try {
        await step.run(`send-recovery-${c.orderId}`, async () => {
          // ─── 1. Mint a 15%-off code, 24h TTL, single redemption ───────
          const expiresAt = Math.floor(Date.now() / 1000) + 86400;
          const codeStr = `COMEBACK${Math.floor(Math.random() * 9000) + 1000}`;
          const coupon = await stripe.coupons.create({
            percent_off: 15,
            duration: "once",
            name: `Cart recovery — order ${c.orderId.slice(0, 8)}`,
            redeem_by: expiresAt,
            max_redemptions: 1,
            metadata: { source: "cart_recovery", orderId: c.orderId },
          });
          await stripe.promotionCodes.create({
            coupon: coupon.id,
            code: codeStr,
            expires_at: expiresAt,
            max_redemptions: 1,
            metadata: { source: "cart_recovery", orderId: c.orderId },
          });

          // ─── 2. Build the email ──────────────────────────────────────
          const firstName = c.agentName ? c.agentName.split(/\s+/)[0] : null;
          const greeting = firstName ? `Hey ${firstName},` : "Hey,";
          const tierLabel = c.tier === "premium" ? "Premium" : c.tier === "rush" ? "Rush" : "Standard";
          const slug = c.listingSlug ?? "";
          const checkoutUrl = slug
            ? `${APP_URL}/l/${slug}?promo=${codeStr}`
            : `${APP_URL}/?promo=${codeStr}#paste`;
          const market = [c.city, c.state].filter(Boolean).join(", ");
          const listingRef =
            c.scrapedTitle ?? (market ? `your ${market} listing` : "your Airbnb listing");
          const amountSavings = `$${((c.amountCents * 0.15) / 100).toFixed(2)}`;

          const subject = `Restay — your checkout for ${listingRef.slice(0, 50)}`;

          const text = `${greeting}

Saw you started a Restay ${tierLabel} Tune-Up for ${listingRef} but didn't make it through checkout. Totally understand — the page can feel abrupt the first time, especially before you've seen any sample output.

Here's what I'll do: 15% off if you finish today, and I'll personally handle the order myself.

  Code: ${codeStr}  (saves ${amountSavings}, expires 24 hours from now)
  One-tap link: ${checkoutUrl}

If you'd rather see proof first — reply to this email with your listing URL and I'll send back two sample photos in the style I'd use, no charge, no commitment. Most hosts who ask see one or two photos and decide on the spot.

Either way, I'm watching this thread personally. Reply with any question — pricing, what's actually delivered, refund policy, anything.

— Jack
Founder, Restay
${APP_URL}
`;

          const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>${greeting}</p>
<p>Saw you started a Restay <strong>${tierLabel}</strong> Tune-Up for ${listingRef} but didn't make it through checkout. Totally understand — the page can feel abrupt the first time, especially before you've seen any sample output.</p>
<p>Here's what I'll do: <strong>15% off if you finish today</strong>, and I'll personally handle the order myself.</p>
<table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;background:#f8fafc;width:100%;margin:14px 0;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;">Discount code</div>
<div style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;font-size:18px;font-weight:700;letter-spacing:0.05em;color:#0f172a;margin-top:4px;">${codeStr}</div>
<div style="font-size:13px;color:#475569;margin-top:8px;">Saves ${amountSavings} on your ${tierLabel} Tune-Up. <strong>Expires 24 hours from now.</strong></div>
<div style="margin-top:12px;"><a href="${checkoutUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">Finish checkout with discount applied →</a></div>
</td></tr>
</table>
<p>If you'd rather see proof first — <strong>reply to this email with your listing URL</strong> and I'll send back two sample photos in the style I'd use, no charge, no commitment. Most hosts who ask see one or two photos and decide on the spot.</p>
<p>Either way, I'm watching this thread personally. Reply with any question — pricing, what's actually delivered, refund policy, anything.</p>
<p>— Jack<br/>Founder, Restay<br/><a href="${APP_URL}" style="color:#475569;">restay.agency</a></p>
</body></html>`;

          // ─── 3. Send via Resend ──────────────────────────────────────
          if (!resend) {
            logger.warn(`[pending-order-watchdog] no RESEND_API_KEY — would send to ${c.customerEmail}`);
            return;
          }
          const result = await resend.emails.send({
            from: `Jack at Restay <jack@${FROM_DOMAIN}>`,
            to: c.customerEmail!,
            replyTo: REPLIES_EMAIL,
            subject,
            text,
            html,
            headers: {
              "Idempotency-Key": `cart-recovery-${c.orderId}`,
            },
            tags: [
              { name: "type", value: "cart_recovery" },
              { name: "tier", value: c.tier },
            ],
          });
          if (result.error) {
            throw new Error(`Resend cart-recovery error: ${result.error.message}`);
          }

          // ─── 4. Log outbound message — both for audit + dedupe ──────
          await db.insert(messages).values({
            orderId: c.orderId,
            listingId: c.listingId,
            direction: "outbound",
            from: `jack@${FROM_DOMAIN}`,
            to: c.customerEmail!,
            subject,
            bodyText: text,
            bodyHtml: html,
            aiReplyGenerated: false,
          });
        });
        sent++;
      } catch (err) {
        failed++;
        logger.error(`Cart-recovery send failed for ${c.orderId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (failed > 0) {
      await step.run("alert-on-failures", async () => {
        await sendOpsAlert({
          severity: "warning",
          subject: `${failed}/${candidates.length} cart-recovery emails failed`,
          body: `Some cart-recovery sends failed in this watchdog run. Check logs and consider manual follow-up for the affected orders.`,
          dedupeKey: "pending-order-watchdog-failures",
        });
      });
    }

    return { sent, failed, total: candidates.length };
  },
);

/**
 * Diagnostic helper for /admin readiness checklist.
 */
export async function countBailedCheckouts(thresholdMinutes = STUCK_THRESHOLD_MIN): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        isNotNull(orders.customerEmail),
        lt(orders.createdAt, cutoff),
      ),
    );
  return Number(row?.n ?? 0);
}
