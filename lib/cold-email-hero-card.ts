/**
 * Hero photo preview card for cold-outreach email bodies.
 *
 * SiteGrid's measurable insight: a single-photo "before" card inside
 * the cold email outperformed a text-only email by ~1.4× on reply
 * rate when the photo was the recipient's own (pulled from Google
 * Places).
 *
 * Pattern:
 *   - Use the recipient's strongest visual (their existing storefront,
 *     listing photo, social cover, whatever) as the card image.
 *   - Overlay a one-line caption in the top-left.
 *   - Below, place the personalized headline + CTA link.
 *   - Plain-text fallback for clients that strip images.
 *
 * Compatible with any HTML-rendering email path. The plain-text body
 * is what most spam filters score against, so keep that natural-
 * sounding too.
 */

export interface HeroCardArgs {
  /** Image URL — must be HTTPS, publicly reachable, ideally <100KB. */
  imageUrl: string;
  /** Caption rendered as a 9pt overlay in the top-left of the image. */
  imageCaption: string;
  /** One-line bold headline rendered under the image. */
  headline: string;
  /** Two-to-three line plain body following the headline. */
  body: string;
  /** Primary CTA URL. */
  ctaUrl: string;
  /** Primary CTA label. */
  ctaLabel: string;
  /** Brand name shown in the small footer. */
  brandName: string;
  /** Optional alt text — defaults to the caption. */
  imageAlt?: string;
}

export interface HeroCardOutput {
  /** Plain-text body to ship as text/plain alongside the HTML. */
  text: string;
  /** Inline HTML body. Already styled — paste into a layout shell. */
  html: string;
}

export function renderHeroCard(args: HeroCardArgs): HeroCardOutput {
  const escapeHtml = (s: string): string =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const text = `${args.headline}

${args.body}

${args.ctaLabel}: ${args.ctaUrl}

— ${args.brandName}
`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;font-size:15px;line-height:1.6;max-width:560px;margin:0 auto;">
  <div style="position:relative;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;background:#f8fafc;">
    <img src="${escapeHtml(args.imageUrl)}" alt="${escapeHtml(args.imageAlt ?? args.imageCaption)}" style="display:block;width:100%;max-height:360px;object-fit:cover;" />
    <div style="position:absolute;top:14px;left:14px;background:rgba(15,23,42,0.85);color:#fff;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;padding:6px 10px;border-radius:6px;">
      ${escapeHtml(args.imageCaption)}
    </div>
  </div>
  <h1 style="font-size:20px;font-weight:700;line-height:1.3;margin:20px 0 10px 0;">
    ${escapeHtml(args.headline)}
  </h1>
  <p style="margin:0 0 20px 0;color:#1e293b;white-space:pre-line;">
    ${escapeHtml(args.body)}
  </p>
  <p style="margin:0 0 28px 0;">
    <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">
      ${escapeHtml(args.ctaLabel)} →
    </a>
  </p>
  <p style="margin:0;color:#64748b;font-size:13px;">
    — ${escapeHtml(args.brandName)}
  </p>
</div>`;

  return { text, html };
}
