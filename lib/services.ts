/**
 * A "service" in StoryPop's model is a SKU — a buyable variant of the
 * same underlying generated book. The generation pipeline (story →
 * illustrations → layout) is identical across SKUs; what differs is
 * delivery (PDF vs print) and price.
 *
 * Adding a SKU is just adding an entry here. Stripe price IDs are set
 * via env, not hardcoded.
 */

export type Audience = "parent";

export type Fulfillment = "digital_pdf" | "lulu_softcover" | "lulu_hardcover" | "lulu_plus_printful_plush";

export interface ServiceDefinition {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  basePriceCents: number;
  /** Optional expedite upcharge. */
  rushPriceCents?: number;
  category: "digital" | "print" | "gift";
  audience: Audience;
  fulfillment: Fulfillment;
  /** Stripe price id env var name (resolved at runtime). */
  stripePriceEnv: string;
  /** Pages in the deliverable. All SKUs render the same book; print formats differ. */
  pageCount: 12 | 14 | 16;
  icon: "FileText" | "Book" | "BookOpen" | "Gift";
  ctaPrimary: string;
  emailSubjectTemplate: string; // {{childName}} replaced
}

export const SERVICES: ServiceDefinition[] = [
  {
    id: "pdf",
    name: "Instant PDF",
    shortDescription:
      "The full book as a high-resolution PDF, delivered to your email within 5 minutes.",
    longDescription:
      "Pip generates the full 16-page book and emails you a print-ready PDF as soon as it's done. Open it on a phone, tablet, or laptop. Print at home or just keep it digital. No shipping, no waiting. Best for last-minute gifts or screen-reading bedtime.",
    basePriceCents: 1499,
    category: "digital",
    audience: "parent",
    fulfillment: "digital_pdf",
    stripePriceEnv: "STRIPE_PRICE_PDF",
    pageCount: 16,
    icon: "FileText",
    ctaPrimary: "Get the PDF",
    emailSubjectTemplate: "{{childName}}'s book is ready",
  },
  {
    id: "softcover",
    name: "Softcover book",
    shortDescription:
      "An 8.5 × 8.5 inch softcover, printed and shipped. 16 pages.",
    longDescription:
      "Pip's full 16-page book, printed on heavy matte paper with a soft-touch cover by Lulu xPress. Standard shipping in 5–8 business days. Sized for little hands.",
    basePriceCents: 2999,
    rushPriceCents: 3999, // +$10 expedite
    category: "print",
    audience: "parent",
    fulfillment: "lulu_softcover",
    stripePriceEnv: "STRIPE_PRICE_SOFTCOVER",
    pageCount: 16,
    icon: "Book",
    ctaPrimary: "Order softcover",
    emailSubjectTemplate: "{{childName}}'s softcover is on its way",
  },
  {
    id: "hardcover",
    name: "Hardcover book",
    shortDescription:
      "A keepsake-quality 8.5 × 11 hardcover with cloth binding. 16 pages.",
    longDescription:
      "Pip's 16-page book in the format that lives on a shelf. Cloth-bound, sewn signatures, premium paper. Printed and shipped by Lulu xPress in 7–10 business days. The version grandparents buy.",
    basePriceCents: 4499,
    rushPriceCents: 5999, // +$15 expedite
    category: "print",
    audience: "parent",
    fulfillment: "lulu_hardcover",
    stripePriceEnv: "STRIPE_PRICE_HARDCOVER",
    pageCount: 16,
    icon: "BookOpen",
    ctaPrimary: "Order hardcover",
    emailSubjectTemplate: "{{childName}}'s hardcover is on its way",
  },
  {
    id: "gift-bundle",
    name: "Gift bundle (hardcover + plush)",
    shortDescription:
      "The hardcover plus a matching plush of the character on the cover. Shipped together.",
    longDescription:
      "The hardcover, plus a Printful-fulfilled plush of Pip's cover character (eight inches, embroidered features, washable). Shipped together in a single gift box. Allow 10–14 business days.",
    basePriceCents: 6999,
    category: "gift",
    audience: "parent",
    fulfillment: "lulu_plus_printful_plush",
    stripePriceEnv: "STRIPE_PRICE_BUNDLE",
    pageCount: 16,
    icon: "Gift",
    ctaPrimary: "Order gift bundle",
    emailSubjectTemplate: "{{childName}}'s gift bundle is on its way",
  },
];

export const DEFAULT_SERVICE_ID = "hardcover";

export function getService(id: string): ServiceDefinition | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function requireService(id: string): ServiceDefinition {
  const s = getService(id);
  if (!s) throw new Error(`Unknown SKU id: ${id}`);
  return s;
}

export function listServices(category?: ServiceDefinition["category"]): ServiceDefinition[] {
  return category ? SERVICES.filter((s) => s.category === category) : SERVICES;
}

export function servicesForAudience(_audience: Audience): ServiceDefinition[] {
  // StoryPop has a single audience (parent) in v1. Helper kept for template
  // signature parity.
  return SERVICES;
}

/** SKUs that are physically printed (excludes PDF). */
export function printSkus(): ServiceDefinition[] {
  return SERVICES.filter((s) => s.fulfillment !== "digital_pdf");
}
