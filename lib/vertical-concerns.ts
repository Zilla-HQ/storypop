/**
 * Per-vertical concern catalog.
 *
 * Different verticals fear different things in the purchase decision.
 * Putting the right concern in the bullets makes follow-up emails feel
 * addressed; the wrong concern reads like a form letter.
 *
 * Used by:
 *   - inngest/functions/abandoned-checkout.ts — vertical-aware bullets
 *     in the "what's blocking you?" email
 *   - inngest/functions/followup-extended.ts — touch 3 bullets
 *   - the inbound-reply objection-handler template
 *
 * Customize per merchant. The catalog below is the SiteGrid-derived
 * starter (websites for local SMBs). For Relist (real-estate photos)
 * the concerns are different — "Will the staged photos match my
 * listing's actual furniture?" etc.
 */

export interface VerticalConcerns {
  vertical: string;
  /** Three to five bullets. Each starts with a customer-voice quote. */
  bullets: string[];
  /** One-line objection-handler opening for inbound classifier replies. */
  objectionOpener: string;
}

const CATALOG: VerticalConcerns[] = [
  {
    vertical: "restaurants",
    bullets: [
      `"How does the domain switch happen without breaking online reservations?"`,
      `"Will Google Business / Yelp / DoorDash links still resolve correctly?"`,
      `"I want a few menu sections rephrased before going live."`,
      `"Can the site link to our existing OpenTable / Resy / Toast setup?"`,
    ],
    objectionOpener:
      "Reservations are the most common worry — the install never touches the existing OpenTable/Resy/Toast wiring; we just point a new front door at them.",
  },
  {
    vertical: "healthcare",
    bullets: [
      `"How does the domain switch happen without breaking patient bookings?"`,
      `"Do existing patient records / portal logins keep working?"`,
      `"Can I see the design on a few real pages before paying?"`,
      `"Is the contact form HIPAA-aware?"`,
    ],
    objectionOpener:
      "Patient portal continuity is the #1 question we get. The new site doesn't touch your PMS / portal — those keep running unchanged.",
  },
  {
    vertical: "legal",
    bullets: [
      `"How does the domain switch work without breaking referral-partner links?"`,
      `"What about ethics-bar rules on testimonials and case results?"`,
      `"Can I see the design on a real custom domain before I commit?"`,
      `"Does the new site preserve our existing intake form?"`,
    ],
    objectionOpener:
      "We're careful with bar-rules — no case-result claims, no client testimonials unless you've cleared them with your state's rules.",
  },
  {
    vertical: "professional",
    bullets: [
      `"How does the domain switch work without breaking the existing site?"`,
      `"What about referral-partner links pointing at the current pages?"`,
      `"Can I see the design on a real custom domain before I commit?"`,
      `"I want to tweak a few sections first."`,
    ],
    objectionOpener:
      "We can preserve referral-partner links via 301 redirects so nothing in your network breaks.",
  },
  {
    vertical: "fitness",
    bullets: [
      `"How does the domain switch happen without breaking class signups?"`,
      `"Do existing member-portal logins keep working?"`,
      `"I want the schedule embedded a specific way."`,
      `"Can the site talk to Mindbody / Glofox / Wodify?"`,
    ],
    objectionOpener:
      "Mindbody / Glofox / Wodify all keep working unchanged — the new site embeds your existing booking widget.",
  },
  {
    vertical: "beauty",
    bullets: [
      `"How does the booking integration work — Vagaro / GlossGenius / Square?"`,
      `"Can I show the full service menu with prices?"`,
      `"Will the gallery aspect ratios look right on mobile?"`,
      `"Can I see the design before paying?"`,
    ],
    objectionOpener:
      "Booking-platform passthrough is the most common ask — Vagaro/GlossGenius/Square all embed cleanly with no migration.",
  },
  {
    vertical: "trades",
    bullets: [
      `"How does the contact / quote form route to my phone or email?"`,
      `"Can I show before-and-after photos of past jobs?"`,
      `"What about the existing Angi / Thumbtack profile — will those still rank?"`,
      `"Can I display service-area pricing?"`,
    ],
    objectionOpener:
      "Angi / Thumbtack profiles are independent — your new site won't compete with them, it'll send the high-intent leads directly to you.",
  },
  {
    vertical: "retail",
    bullets: [
      `"How does the new site connect to Shopify / Square / our existing POS?"`,
      `"Can we keep the same product catalog and inventory?"`,
      `"What about the existing Google Shopping / Instagram Shop feeds?"`,
      `"Will the cart and checkout still work?"`,
    ],
    objectionOpener:
      "Shopify / Square / Lightspeed all stay as-is — the new site is a fresh front-end pointed at your same backend.",
  },
];

const FALLBACK: VerticalConcerns = {
  vertical: "fallback",
  bullets: [
    `"How does the domain switch work without breaking the existing site?"`,
    `"Can I see the design on a real custom domain before I commit?"`,
    `"I want to tweak a few sections first."`,
  ],
  objectionOpener:
    "The most common worry is the domain handover — it's a zero-downtime DNS swap; the old site keeps serving until the new one is live.",
};

export function concernsFor(vertical: string | null | undefined): VerticalConcerns {
  if (!vertical) return FALLBACK;
  return CATALOG.find((c) => c.vertical === vertical) ?? FALLBACK;
}

export function allVerticals(): string[] {
  return CATALOG.map((c) => c.vertical);
}

/**
 * Format the concern bullets for inline use in a plain-text email body.
 * Returns multi-line text with two-space indent.
 */
export function formatBullets(vertical: string | null | undefined): string {
  return concernsFor(vertical)
    .bullets.map((b) => `  • ${b}`)
    .join("\n");
}
