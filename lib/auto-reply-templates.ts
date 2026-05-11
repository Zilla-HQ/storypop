/**
 * Deterministic auto-reply templates per docs/email-templates.md.
 *
 * Why deterministic: an LLM rewrite occasionally drops the checkout link,
 * shifts pricing, or contradicts the discount math. These templates are
 * fixed and tested — only the {variables} change.
 */

export type AutoReplyTemplate = "price" | "style" | "decline";

export interface AutoReplyVars {
  firstName: string;
  listingShortAddress: string;
  listingTypeLabel: string;
  listingPageUrl: string;
  checkoutUrl: string;
  tuneupPrice: string;
  rushPrice: string;
  photoOnlyPrice: string;
  promoCode?: string;
  promoDiscountPct?: number;
  promoExpiryDays?: number;
  supportEmail: string;
  senderName: string;
}

export interface RenderedAutoReply {
  subject: string;
  text: string;
  mjml: string;
}

export function renderAutoReply(
  template: AutoReplyTemplate,
  inboundSubject: string | null,
  v: AutoReplyVars,
): RenderedAutoReply {
  const subject = inboundSubject?.startsWith("Re:")
    ? inboundSubject
    : `Re: ${inboundSubject ?? "your Airbnb listing"}`;

  switch (template) {
    case "price":
      return { subject, text: priceText(v), mjml: priceMjml(v) };
    case "style":
      return { subject, text: styleText(v), mjml: styleMjml(v) };
    case "decline":
      return { subject, text: declineText(v), mjml: declineMjml(v) };
  }
}

// ─── price_question — Email 2 ──────────────────────────────────────────

function priceText(v: AutoReplyVars): string {
  const promoLine =
    v.promoCode && v.promoDiscountPct && v.promoExpiryDays
      ? `Since you replied within 7 days of our first email, I've applied a ${v.promoDiscountPct}% founding-host discount to your link below. It's locked in for ${v.promoExpiryDays} days.

Click to pay (discount pre-applied):
${appendCode(v.checkoutUrl, v.promoCode)}`
      : `Click to buy:
${v.checkoutUrl}`;

  return `Hi ${v.firstName},

Three options, all one-time fees, no subscription:

  • Tune-Up — ${v.tuneupPrice} — rewritten title + description, 10 restyled photos, 30-day pricing recommendation. 48-hour turnaround.
  • Rush Tune-Up — ${v.rushPrice} — same package, 24-hour turnaround.
  • Photo Restyle only — ${v.photoOnlyPrice} — 10 restyled photos, no copy or pricing work.

${promoLine}

What you get and when:

  1. Confirmation email from ${v.supportEmail} the moment Stripe clears. Includes a private link to download your zip.

  2. Restyled photos (declutter, relight, color grade, replace overcast skies). Originals always retained. We never add or remove furniture — Airbnb's listing-photo policy forbids it, and we're built around that constraint.

  3. Rewritten title + description tuned to your listing's strongest signals (review highlights, neighborhood, amenity stack).

  4. A 30-day pricing report comparing your nightly rate against ~30 comparable listings in ${v.listingShortAddress} — comp median, p25, p75, and a recommended weekday + weekend rate.

For anything else — re-run with a different style, additional photos beyond the first 10, custom requests — just email ${v.supportEmail} and we'll handle it within 24 hours.

— ${v.senderName}`;
}

function priceMjml(v: AutoReplyVars): string {
  const buyUrl =
    v.promoCode && v.promoDiscountPct
      ? appendCode(v.checkoutUrl, v.promoCode)
      : v.checkoutUrl;
  const promoBlock =
    v.promoCode && v.promoDiscountPct && v.promoExpiryDays
      ? `<mj-text>Since you replied within 7 days of our first email, I've applied a <b>${v.promoDiscountPct}% founding-host discount</b> to your link below. Locked in for ${v.promoExpiryDays} days.</mj-text>`
      : "";
  return `<mjml><mj-head><mj-attributes><mj-text font-size="15px" line-height="1.55" /></mj-attributes></mj-head>
    <mj-body><mj-section padding="24px"><mj-column>
      <mj-text>Hi ${v.firstName},</mj-text>
      <mj-text>Three options, all one-time fees, no subscription:</mj-text>
      <mj-text>
        • <b>Tune-Up — ${v.tuneupPrice}</b> — rewritten title + description, 10 restyled photos, 30-day pricing recommendation. 48-hour turnaround.<br/>
        • <b>Rush Tune-Up — ${v.rushPrice}</b> — same package, 24-hour turnaround.<br/>
        • <b>Photo Restyle only — ${v.photoOnlyPrice}</b> — 10 restyled photos, no copy or pricing work.
      </mj-text>
      ${promoBlock}
      <mj-button href="${buyUrl}" background-color="#111827" color="#ffffff" border-radius="8px">Buy Tune-Up</mj-button>
      <mj-text>Restyled photos: declutter, relight, color grade, replace overcast skies. Originals always retained. We never add or remove furniture — Airbnb's listing-photo policy forbids it, and we're built around that constraint.</mj-text>
      <mj-text>30-day pricing report compares your nightly rate against ~30 comparable listings in ${v.listingShortAddress} — comp median, p25, p75, recommended weekday + weekend rates.</mj-text>
      <mj-text>For anything else, just email ${v.supportEmail} — we'll handle it within 24 hours.</mj-text>
      <mj-text>— ${v.senderName}</mj-text>
    </mj-column></mj-section></mj-body></mjml>`;
}

// ─── style_question — Email 3 ──────────────────────────────────────────

function styleText(v: AutoReplyVars): string {
  return `Hi ${v.firstName},

What we edit and what we don't:

  EDITED:
  • Color grade — fix yellow tungsten interiors, even out exposure
  • Relight — brighten dark rooms, reduce shadow on key surfaces
  • Declutter — remove cables, bottles, mail, distracting objects on counters
  • Skies — replace overcast with bright-overcast (no fake sun, no impossible blue)
  • Crop — straighten and recompose for Airbnb thumbnail aspect

  NOT EDITED:
  • We never add furniture, plants, art, or rugs — Airbnb policy forbids it
  • We never remove permanent fixtures (cabinets, fans, outlets)
  • We never alter property dimensions, ceiling height, or window placement
  • Originals are retained alongside the edits

The full Tune-Up — 10 restyled photos plus rewritten copy and a pricing report — is ${v.tuneupPrice} one-time. Photo-only is ${v.photoOnlyPrice}.

${v.checkoutUrl}

— ${v.senderName}`;
}

function styleMjml(v: AutoReplyVars): string {
  return `<mjml><mj-head><mj-attributes><mj-text font-size="15px" line-height="1.55" /></mj-attributes></mj-head>
    <mj-body><mj-section padding="24px"><mj-column>
      <mj-text>Hi ${v.firstName},</mj-text>
      <mj-text font-weight="700">EDITED</mj-text>
      <mj-text>
        • Color grade — fix yellow tungsten interiors, even out exposure<br/>
        • Relight — brighten dark rooms, reduce shadow on key surfaces<br/>
        • Declutter — remove cables, bottles, mail, distracting objects on counters<br/>
        • Skies — replace overcast with bright-overcast<br/>
        • Crop — straighten and recompose for Airbnb thumbnail aspect
      </mj-text>
      <mj-text font-weight="700">NOT EDITED</mj-text>
      <mj-text>
        • Never add furniture, plants, art, or rugs — Airbnb policy forbids it<br/>
        • Never remove permanent fixtures (cabinets, fans, outlets)<br/>
        • Never alter property dimensions, ceiling height, or window placement<br/>
        • Originals retained alongside the edits
      </mj-text>
      <mj-text>Full Tune-Up: <b>${v.tuneupPrice}</b> one-time. Photo-only: <b>${v.photoOnlyPrice}</b>.</mj-text>
      <mj-button href="${v.checkoutUrl}" background-color="#111827" color="#ffffff" border-radius="8px">See your audit + buy</mj-button>
      <mj-text>— ${v.senderName}</mj-text>
    </mj-column></mj-section></mj-body></mjml>`;
}

// ─── decline — Email 4 ─────────────────────────────────────────────────

function declineText(v: AutoReplyVars): string {
  return `Hi ${v.firstName},

Totally understand — appreciate you replying. I'll stop bumping you.

If anything changes, your free audit is at ${v.listingPageUrl} and stays up for a few weeks.

— ${v.senderName}`;
}

function declineMjml(v: AutoReplyVars): string {
  return `<mjml><mj-body><mj-section padding="24px"><mj-column>
    <mj-text font-size="15px" line-height="1.55">Hi ${v.firstName},</mj-text>
    <mj-text font-size="15px" line-height="1.55">Totally understand — appreciate you replying. I'll stop bumping you.</mj-text>
    <mj-text font-size="15px" line-height="1.55">If anything changes, your free audit is at <a href="${v.listingPageUrl}">${v.listingPageUrl}</a> and stays up for a few weeks.</mj-text>
    <mj-text font-size="15px" line-height="1.55">— ${v.senderName}</mj-text>
  </mj-column></mj-section></mj-body></mjml>`;
}

function appendCode(url: string, code: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}code=${encodeURIComponent(code)}`;
}
