/**
 * Per-vertical copy labels — generates feature callouts and noun forms that
 * match the customer's industry. Used in outreach email bodies, auto-replies,
 * and on-site copy.
 *
 * Why this exists: a generic "websites for businesses" email under-performs a
 * vertical-specific "websites for restaurants with online reservations" by
 * 30-50% on reply rate. Cost is one extra prompt input + this lookup.
 *
 * Add new verticals to VERTICALS as needed. Unknown verticals fall back to a
 * generic-but-plausible default.
 */
export type Vertical =
  | "restaurant"
  | "salon"
  | "fitness"
  | "dental"
  | "law"
  | "trades"
  | "retail"
  | "realestate"
  | "auto"
  | "default";

interface VerticalCopy {
  /** Singular noun for an instance — "restaurant", "salon", "law firm". */
  singular: string;
  /** Plural form — "restaurants", "salons", "law firms". */
  plural: string;
  /** A signature feature for the merchant's pitch — "online reservations". */
  signatureFeature: string;
  /** The customer's job-to-be-done verb — "book a table", "schedule an appointment". */
  customerVerb: string;
  /** What customers are actively trying to do when they search Google. */
  searchIntent: string;
}

const VERTICALS: Record<Vertical, VerticalCopy> = {
  restaurant: {
    singular: "restaurant",
    plural: "restaurants",
    signatureFeature: "online reservations",
    customerVerb: "book a table",
    searchIntent: "find a place to eat tonight",
  },
  salon: {
    singular: "salon",
    plural: "salons",
    signatureFeature: "online booking",
    customerVerb: "schedule an appointment",
    searchIntent: "book a haircut or color",
  },
  fitness: {
    singular: "studio",
    plural: "studios",
    signatureFeature: "class schedule + signups",
    customerVerb: "sign up for a class",
    searchIntent: "find a gym or class",
  },
  dental: {
    singular: "dental practice",
    plural: "dental practices",
    signatureFeature: "online appointment requests",
    customerVerb: "request an appointment",
    searchIntent: "find a dentist nearby",
  },
  law: {
    singular: "law firm",
    plural: "law firms",
    signatureFeature: "free consultation requests",
    customerVerb: "request a consultation",
    searchIntent: "find an attorney",
  },
  trades: {
    singular: "business",
    plural: "trade businesses",
    signatureFeature: "instant quote requests",
    customerVerb: "request a quote",
    searchIntent: "find someone to do the work",
  },
  retail: {
    singular: "shop",
    plural: "shops",
    signatureFeature: "store hours and product highlights",
    customerVerb: "see what's in stock",
    searchIntent: "find a local shop",
  },
  realestate: {
    singular: "agent",
    plural: "agents",
    signatureFeature: "MLS-quality listing photos",
    customerVerb: "view a listing",
    searchIntent: "find a realtor or browse listings",
  },
  auto: {
    singular: "shop",
    plural: "auto shops",
    signatureFeature: "service appointment requests",
    customerVerb: "schedule service",
    searchIntent: "find a mechanic",
  },
  default: {
    singular: "business",
    plural: "businesses",
    signatureFeature: "a contact form your customers can actually use",
    customerVerb: "get in touch",
    searchIntent: "find what they're looking for",
  },
};

/** Look up a vertical's copy by key, falling back to "default" if unknown. */
export function getVerticalCopy(key: string | null | undefined): VerticalCopy {
  if (!key) return VERTICALS.default;
  const k = key.toLowerCase().trim() as Vertical;
  return VERTICALS[k] ?? VERTICALS.default;
}

export function getVerticalSingular(key: string | null | undefined): string {
  return getVerticalCopy(key).singular;
}
export function getVerticalPlural(key: string | null | undefined): string {
  return getVerticalCopy(key).plural;
}
export function getVerticalFeature(key: string | null | undefined): string {
  return getVerticalCopy(key).signatureFeature;
}
export function getVerticalCustomerVerb(key: string | null | undefined): string {
  return getVerticalCopy(key).customerVerb;
}
