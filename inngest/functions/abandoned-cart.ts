import { inngest } from "@/inngest/client";
import { db, listings, previews, orders, outreachEvents } from "@/db";
import { eq, sql } from "drizzle-orm";
import { sendComplianceEmail, pickSenderDomain } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { shortAddress, formatCents } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";
import { env } from "@/lib/env";

const TEMPLATE_ID = "abandoned_cart_recovery_v1";
const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
const RECOVERY_PROMO = env("ABANDONED_CART_PROMO", "LAUNCH50")!;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Hourly cron — sends a recovery email to anyone who reached the Stripe
 * checkout step but didn't complete payment. These are the hottest
 * conversion targets in the funnel: they already saw the price and
 * clicked. Idempotent on TEMPLATE_ID so no recipient is re-emailed.
 *
 * Window: orders 30 min < age < 14 days. Younger to give them a chance
 * to complete on their own; older to stay relevant.
 */
export const abandonedCartFn = inngest.createFunction(
  {
    id: "abandoned-cart-recovery",
    name: "Abandoned Cart Recovery (hourly)",
    retries: 1,
  },
  // Every hour at :17 (offset from other crons to spread DB load)
  [{ cron: "17 * * * *" }, { event: "abandoned-cart/manual" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.outreachPaused) {
      return { skipped: true, reason: "paused" };
    }

    const targets = await step.run("find-targets", async () => {
      const rows = await db.execute(sql`
        SELECT o.id as order_id,
               o.listing_id,
               o.tier,
               o.amount_cents,
               o.customer_email,
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
          ORDER BY created_at DESC LIMIT 1
        ) p ON true
        WHERE o.status = 'pending'
          AND o.created_at < now() - interval '30 minutes'
          AND o.created_at > now() - interval '14 days'
          AND o.amount_cents > 0
          AND NOT EXISTS (
            SELECT 1 FROM relist.outreach_events e
            WHERE e.listing_id = o.listing_id AND e.template_id = ${TEMPLATE_ID}
          )
        LIMIT 25
      `);
      return rows as unknown as Array<{
        order_id: string;
        listing_id: string;
        tier: "standard" | "premium" | "rush";
        amount_cents: number;
        customer_email: string | null;
        address: string;
        slug: string;
        agent_email: string | null;
        agent_name: string | null;
        preview_id: string | null;
      }>;
    });

    if (targets.length === 0) {
      return { skipped: true, reason: "no abandoned carts" };
    }

    const blacklist = new Set(settings.emailBlacklist.map((e) => e.toLowerCase()));
    const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";

    let sent = 0;
    let skipped = 0;

    for (const t of targets) {
      const recipient = (t.customer_email ?? t.agent_email ?? "").toLowerCase();
      if (!recipient || blacklist.has(recipient)) {
        skipped += 1;
        continue;
      }

      await step.run(`send-${t.order_id}`, async () => {
        const firstName = (t.agent_name ?? "there").split(" ")[0];
        const addr = shortAddress(t.address);
        const fullPrice = formatCents(t.amount_cents);
        const discountedPrice = formatCents(Math.round(t.amount_cents * 0.5));
        const checkoutLink = `${APP_URL}/l/${t.slug}?code=${RECOVERY_PROMO}&utm_source=email&utm_campaign=abandoned_cart`;
        const previewImg = t.preview_id ? `${APP_URL}/api/img/${t.preview_id}?i=0&kind=after` : null;

        const subject = `Looks like ${addr} didn't finish checkout — 50% off if you come back`;
        const bodyText = `Hey ${firstName},

Saw you started checkout on ${addr}'s ${t.tier} package and didn't finish. No pressure — but if it was a price thing, here's 50% off (code ${RECOVERY_PROMO}, expires soon):

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
            <mj-text align="center" font-size="14px" font-weight="700" color="#92400e">⏱ Cart recovery — 50% off with code ${escapeHtml(RECOVERY_PROMO)}</mj-text>
          </mj-column></mj-section>
          <mj-section background-color="#ffffff" padding="32px 32px 8px"><mj-column>
            <mj-text font-size="16px" line-height="1.6">Hey ${escapeHtml(firstName)},</mj-text>
            <mj-text font-size="16px" line-height="1.6">Saw you started checkout on <b>${escapeHtml(addr)}</b>'s ${escapeHtml(t.tier)} package and didn't finish. No pressure — but if it was a price thing, here's <b>50% off</b> the same package:</mj-text>
          </mj-column></mj-section>
          ${previewMjml}
          <mj-section background-color="#ffffff" padding="20px 32px 4px"><mj-column>
            <mj-text font-size="14px" color="#1f2937"><span style="color:#9ca3af;text-decoration:line-through">${escapeHtml(fullPrice)}</span> → <b style="color:#047857">${escapeHtml(discountedPrice)}</b> with code <b>${escapeHtml(RECOVERY_PROMO)}</b></mj-text>
          </mj-column></mj-section>
          <mj-section background-color="#ffffff" padding="14px 32px 24px" border-radius="0 0 14px 14px"><mj-column>
            <mj-button href="${checkoutLink}" background-color="#047857" color="#ffffff" font-size="15px" font-weight="700" padding="6px 0 4px" inner-padding="16px 30px" border-radius="8px" align="left">
              Pick up where you left off — ${escapeHtml(discountedPrice)} →
            </mj-button>
            <mj-text font-size="12px" color="#64748b" padding="8px 0 0">Code auto-applies. 14-day refund. NAR-compliant.</mj-text>
          </mj-column></mj-section>
        </mj-body></mjml>`;

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
      });
    }

    await trackEvent({
      distinctId: "abandoned-cart-recovery",
      event: "abandoned_cart_swept",
      properties: { sent, skipped, target_count: targets.length },
    });

    logger.info(`Abandoned-cart recovery: ${sent} sent, ${skipped} skipped of ${targets.length} candidates`);
    return { sent, skipped, target_count: targets.length };
  },
);
