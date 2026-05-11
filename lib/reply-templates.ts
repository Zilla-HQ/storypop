/**
 * Deterministic auto-reply templates for inbound email classifications.
 *
 * Why fixed templates and not LLM-generated rewrites:
 * an LLM occasionally drops the purchase link, contradicts the discount, or
 * shifts tone in ways we can't QA. The templates are tested once; only the
 * variables change per recipient.
 */

import type { ReplyClassification } from "@/lib/claude";

export interface TemplateVars {
  /** Agent's first name; falls back to "there" */
  firstName: string;
  /** Listing address — used in P.S. and operator-notify */
  listingAddress: string;
  /** Public preview URL: https://realscale.app/l/<slug> */
  previewUrl: string;
  /** Checkout URL (preview page with #pricing anchor, optional ?code=) */
  purchaseUrl: string;
  /** Standard price (Standard tier) — dollars int */
  standardPriceUsd: number;
  /** Premium price (Premium tier) — dollars int */
  premiumPriceUsd: number;
  /** Rush price (Rush tier) — dollars int */
  rushPriceUsd: number;
  /** Active promo code, or null to omit discount language */
  promoCode: string | null;
  /** Promo discount percentage (e.g. 10 for 10%), or null */
  promoDiscountPct: number | null;
  /** Days until promo expires */
  promoExpiryDays: number;
  /** Support inbox shown to recipients */
  supportEmail: string;
  /** "From" name on the auto-reply */
  senderName: string;
}

export interface RenderedReply {
  subject: string;
  text: string;
  /** Mjml that compiles to the html body — must include <head><meta charset="utf-8"> */
  mjml: string;
}

const INTRO_LINE = (vars: TemplateVars) =>
  vars.promoCode && vars.promoDiscountPct
    ? `Happy to hear that. Since you're one of our first customers, here's a ${vars.promoDiscountPct}% founding-customer discount applied to your link below.`
    : `Happy to hear that. Here's everything you need to get started — your preview is ready and the checkout is one click.`;

/**
 * Render the deterministic auto-reply for a given classification.
 * Returns null when no auto-reply should be sent (unsubscribe, complex).
 */
export function renderReply(
  classification: ReplyClassification,
  originalSubject: string | null | undefined,
  vars: TemplateVars,
): RenderedReply | null {
  const subj = originalSubject?.startsWith("Re:")
    ? originalSubject
    : `Re: ${originalSubject ?? "your listing"}`;

  if (classification === "interested" || classification === "price_question" || classification === "style_question") {
    return renderInterestedOrPrice(subj, vars);
  }
  if (classification === "decline") {
    return renderDecline(subj, vars);
  }
  // unsubscribe + complex are handled separately (no auto-reply)
  return null;
}

function renderInterestedOrPrice(subject: string, v: TemplateVars): RenderedReply {
  const intro = INTRO_LINE(v);
  const promoLine =
    v.promoCode && v.promoDiscountPct
      ? `\nThe founding rate expires in ${v.promoExpiryDays} days. After that prices return to standard ($${v.standardPriceUsd} / $${v.premiumPriceUsd} / $${v.rushPriceUsd}).\n`
      : `\nPricing:\n  Standard $${v.standardPriceUsd} — every interior photo virtually staged, under 2-hour delivery\n  Premium  $${v.premiumPriceUsd} — every photo, 4 style options, twilight + sky replacement\n  Rush     $${v.rushPriceUsd} — under 30-minute delivery, priority queue\n`;

  const text = `Hi ${v.firstName},

${intro}

Click to pay (${v.promoCode ? "discount pre-applied" : "preview is free, you only pay when you order"}):
${v.purchaseUrl}

Here's exactly what happens after you pay:

  1. You'll get a confirmation email from ${v.supportEmail} within minutes with a download link to your enhanced photos.

  2. Standard tier delivers in under 2 hours. Rush in under 30 minutes. We email you the moment they're ready.

  3. Every staged photo is stamped "Virtually Staged" in the corner per NAR guidance. We can also provide a written disclosure for your MLS entry.

  4. For anything bigger — copy rewrites, custom edits, re-runs — just email ${v.supportEmail} and we'll handle it within 24 hours. Same address for support, billing, refunds, anything else. No ticket system.

A few things included by default:
  - Full refund within 14 days, no questions
  - Free re-run of any single photo if it doesn't feel right
  - Originals stored encrypted, deleted 30 days after delivery
  - NAR-compliant "Virtually Staged" disclosure stamped on every photo
${promoLine}
— ${v.senderName}

P.S. Your refreshed preview is ready at the same link:
${v.previewUrl}
`;

  const mjml = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding="24px">
      <mj-column>
        <mj-text font-size="15px" line-height="1.55" color="#1f2937">
          Hi ${escape(v.firstName)},
        </mj-text>
        <mj-text font-size="15px" line-height="1.55" color="#1f2937">
          ${escape(intro)}
        </mj-text>
        <mj-button href="${v.purchaseUrl}" background-color="#0ea5e9" color="#ffffff" font-weight="700" border-radius="6px" padding="20px 0">
          ${v.promoCode ? "Pay (discount pre-applied)" : "Order — preview is free"}
        </mj-button>
        <mj-text font-size="14px" line-height="1.55" color="#374151">
          <strong>Here's exactly what happens after you pay:</strong>
        </mj-text>
        <mj-text font-size="14px" line-height="1.55" color="#374151">
          1. You'll get a confirmation email from ${escape(v.supportEmail)} within minutes with a download link to your enhanced photos.<br/>
          2. Standard tier delivers in under 2 hours. Rush in under 30 minutes. We email you the moment they're ready.<br/>
          3. Every staged photo is stamped "Virtually Staged" in the corner per NAR guidance.<br/>
          4. For anything bigger — copy rewrites, custom edits, re-runs — email ${escape(v.supportEmail)} and we'll handle it within 24 hours.
        </mj-text>
        <mj-text font-size="14px" line-height="1.55" color="#374151">
          <strong>Included by default:</strong><br/>
          • Full refund within 14 days, no questions<br/>
          • Free re-run of any single photo<br/>
          • Originals encrypted, deleted 30 days after delivery<br/>
          • NAR-compliant "Virtually Staged" disclosure stamped on every photo
        </mj-text>
        ${
          v.promoCode && v.promoDiscountPct
            ? `<mj-text font-size="13px" color="#6b7280" font-style="italic">The founding rate expires in ${v.promoExpiryDays} days. After that prices return to standard ($${v.standardPriceUsd} / $${v.premiumPriceUsd} / $${v.rushPriceUsd}).</mj-text>`
            : `<mj-text font-size="13px" color="#6b7280">Standard $${v.standardPriceUsd} · Premium $${v.premiumPriceUsd} · Rush $${v.rushPriceUsd}</mj-text>`
        }
        <mj-text font-size="15px" line-height="1.55" color="#1f2937">
          — ${escape(v.senderName)}
        </mj-text>
        <mj-text font-size="13px" line-height="1.55" color="#6b7280">
          P.S. Your refreshed preview is ready at the same link:<br/>
          <a href="${v.previewUrl}" style="color:#0ea5e9">${escape(v.previewUrl)}</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  return { subject, text, mjml };
}

function renderDecline(subject: string, v: TemplateVars): RenderedReply {
  const text = `Hi ${v.firstName},

Totally understand — appreciate you replying. I'll stop bumping you.

If anything changes, the preview stays up at ${v.previewUrl} for a few weeks.

— ${v.senderName}
`;

  const mjml = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding="24px">
      <mj-column>
        <mj-text font-size="15px" line-height="1.55" color="#1f2937">
          Hi ${escape(v.firstName)},
        </mj-text>
        <mj-text font-size="15px" line-height="1.55" color="#1f2937">
          Totally understand — appreciate you replying. I'll stop bumping you.
        </mj-text>
        <mj-text font-size="14px" line-height="1.55" color="#374151">
          If anything changes, the preview stays up at <a href="${v.previewUrl}" style="color:#0ea5e9">${escape(v.previewUrl)}</a> for a few weeks.
        </mj-text>
        <mj-text font-size="15px" line-height="1.55" color="#1f2937">
          — ${escape(v.senderName)}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  return { subject, text, mjml };
}

/** Heat emoji per classification, used in operator-notify subject prefixes. */
export const CLASSIFICATION_EMOJI: Record<ReplyClassification, string> = {
  interested: "🔥",
  price_question: "💰",
  style_question: "🎨",
  decline: "↘️",
  unsubscribe: "✋",
  complex: "⚠️",
};

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
