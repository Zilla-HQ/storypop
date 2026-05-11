/**
 * Immediate "we got your order" confirmation email — fires from the
 * Stripe webhook the moment payment lands, decoupled from the long-
 * running fulfillment job.
 *
 * Customers are hostile to silence; this email sets the SLA expectation
 * and gives them a real human to reply to while their order is being
 * processed. Restay's first paid customer (META_ADS.md §5b) refunded
 * after 17 minutes of silence between payment and delivery — exactly
 * the gap this email closes.
 *
 * Failure here is non-fatal — the webhook returns 200 to Stripe
 * regardless. Fulfillment remains the source of truth for "did the
 * customer actually get their deliverables."
 *
 * Per-merchant: edit TIER_COPY below to match this merchant's tier
 * names + deliverables. The shape stays the same across forks.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

const apiKey = env("RESEND_API_KEY");
const resend = apiKey ? new Resend(apiKey) : null;

const SENDER_DOMAINS = (env("SENDER_DOMAINS", "mail.example.com") ?? "mail.example.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FROM_DOMAIN = SENDER_DOMAINS[0] ?? "mail.example.com";
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://example.com") ?? "https://example.com").replace(/\/$/, "");
const BUSINESS_NAME = env("BUSINESS_NAME", "Restay")!;
const REPLIES_EMAIL = env("REPLIES_EMAIL", `jack@${FROM_DOMAIN}`)!;
const FOUNDER_FIRST_NAME = env("FOUNDER_FIRST_NAME", "Jack")!;

export interface OrderConfirmationArgs {
  to: string;
  customerName: string | null;
  orderId: string;
  /** Tier slug. Tier-specific copy lives in TIER_COPY below. */
  tier: string;
  amountCents: number;
  /** Optional: source URL the customer paid against (Airbnb listing,
   *  property address, etc.). Surfaces in the email body for context. */
  sourceUrl?: string | null;
}

/**
 * Per-merchant: edit this map to match your tier names + deliverables.
 * Defaults are Restay's (airbnb merchant); rewrite per-vertical when
 * forking. The keys must match `orders.tier` enum values.
 */
const TIER_COPY: Record<
  string,
  { sla: string; deliverables: string; tagline: string }
> = {
  standard: {
    sla: "under 4 hours",
    deliverables: "the full Tune-Up — rewritten copy + 10 restyled photos + a 30-day pricing report",
    tagline: "Your Listing Tune-Up",
  },
  premium: {
    sla: "under 4 hours",
    deliverables:
      "the Premium Tune-Up — rewritten copy with A/B title variants + 20 restyled photos + a seasonal pricing calendar",
    tagline: "Your Premium Tune-Up",
  },
  rush: {
    sla: "under 24 hours",
    deliverables: "the standard Tune-Up on priority queue — rewritten copy + 10 restyled photos + a 30-day pricing report",
    tagline: "Your Rush Tune-Up",
  },
};

const DEFAULT_COPY = {
  sla: "the SLA window committed at checkout",
  deliverables: "everything in your order",
  tagline: "Your order",
};

export async function sendOrderConfirmation(args: OrderConfirmationArgs): Promise<{ id: string | null }> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn(`[order-confirmation] stub send to ${args.to} (no RESEND_API_KEY)`);
    return { id: null };
  }

  const tier = TIER_COPY[args.tier] ?? DEFAULT_COPY;
  const firstName = args.customerName ? args.customerName.split(/\s+/)[0] : null;
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";
  const amount = `$${(args.amountCents / 100).toFixed(2)}`;

  const subject = `${tier.tagline} is in the queue — delivery ${tier.sla}`;

  const text = `${greeting}

Got your ${amount} order — payment landed and we're on it.

What's coming:
  ${tier.deliverables}

Delivery ETA: ${tier.sla} (we'll send a separate email with everything the moment it's ready).

If anything changes between now and delivery, or you want a specific angle prioritized, just reply to this email. I see every reply personally.

— ${FOUNDER_FIRST_NAME}
Founder, ${BUSINESS_NAME}
${APP_URL}

---
Order ID: ${args.orderId}
${args.sourceUrl ? `Source: ${args.sourceUrl}` : ""}
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>${greeting}</p>

<p>Got your <strong>${amount}</strong> order — payment landed and we're on it.</p>

<table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;background:#f8fafc;width:100%;margin:14px 0;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;">What's coming</div>
<div style="font-size:14px;color:#0f172a;margin-top:6px;">${tier.deliverables}</div>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;margin-top:14px;">Delivery ETA</div>
<div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">${tier.sla}</div>
<div style="font-size:13px;color:#475569;margin-top:6px;">You'll get a separate email with everything the moment it's ready.</div>
</td></tr>
</table>

<p>If anything changes between now and delivery, or you want a specific angle prioritized — <strong>just reply to this email</strong>. I see every reply personally.</p>

<p>— ${FOUNDER_FIRST_NAME}<br/>Founder, ${BUSINESS_NAME}<br/><a href="${APP_URL}" style="color:#475569;">${APP_URL.replace(/^https?:\/\//, "")}</a></p>

<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;"/>
<p style="font-size:11px;color:#94a3b8;">Order ID: <code style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;">${args.orderId}</code>${args.sourceUrl ? `<br/>Source: <a href="${args.sourceUrl}" style="color:#94a3b8;">${args.sourceUrl}</a>` : ""}</p>
</body></html>`;

  const result = await resend.emails.send({
    from: `${FOUNDER_FIRST_NAME} at ${BUSINESS_NAME} <${FOUNDER_FIRST_NAME.toLowerCase()}@${FROM_DOMAIN}>`,
    to: args.to,
    replyTo: REPLIES_EMAIL,
    subject,
    text,
    html,
    headers: {
      "Idempotency-Key": `order-confirm-${args.orderId}`,
    },
    tags: [
      { name: "type", value: "order_confirmation" },
      { name: "tier", value: args.tier },
    ],
  });

  if (result.error) {
    throw new Error(`Resend confirmation error: ${result.error.message}`);
  }
  return { id: result.data?.id ?? null };
}
