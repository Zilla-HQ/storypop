/**
 * Domain-level blocklist for outbound email.
 *
 * Sitebeat sells SEO monitoring to small + medium businesses. Cold
 * outreach and audit-discovery scrapers occasionally surface contact
 * emails at Fortune-500s, major publishers, and noreply addresses —
 * none of those will ever convert, all of them hurt our sender
 * reputation when we email them.
 *
 * This list is enforced at the lib/resend.ts chokepoint (every
 * outbound path ends up there) AND at audit-discovery + email-
 * backfill time so we don't even persist these emails into our DB.
 */

// Domains we should never email cold — too big to ever buy from us.
// Lowercase, no protocol, no subdomain wildcards (we strip subdomains
// before checking).
const BLOCKED_DOMAINS = new Set<string>([
  // Big Tech / hyperscalers
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.es",
  "amazon.it", "amazon.co.jp", "amazon.in", "amazon.com.au",
  "amazon.com.br", "amazon.ca", "amazon.com.mx", "amazon.nl",
  "google.com", "googlemail.com", "alphabet.com", "youtube.com",
  "microsoft.com", "microsoftonline.com", "outlook.com", "live.com",
  "msn.com", "bing.com",
  "apple.com",
  "meta.com", "facebook.com", "instagram.com", "whatsapp.com",
  "x.com", "twitter.com",
  "tiktok.com", "bytedance.com",
  "netflix.com", "spotify.com", "uber.com", "airbnb.com",
  "linkedin.com",
  "salesforce.com", "oracle.com", "sap.com", "ibm.com",
  "tesla.com", "spacex.com",
  "nvidia.com", "amd.com", "intel.com",
  "openai.com", "anthropic.com",

  // Major news / publishers
  "nytimes.com", "wsj.com", "washingtonpost.com", "bloomberg.com",
  "cnn.com", "bbc.com", "bbc.co.uk", "reuters.com", "theguardian.com",
  "ft.com", "economist.com",
  "buzzfeed.com", "vox.com", "huffpost.com", "huffingtonpost.com",
  "forbes.com", "businessinsider.com",

  // Major retailers / consumer brands
  "walmart.com", "target.com", "costco.com", "homedepot.com",
  "lowes.com", "bestbuy.com", "kroger.com", "cvs.com", "walgreens.com",
  "macys.com", "nordstrom.com",
  "starbucks.com", "mcdonalds.com", "cocacola.com", "pepsico.com",
  "nike.com", "adidas.com", "underarmour.com",

  // Financial / payments
  "jpmorganchase.com", "jpmchase.com", "bankofamerica.com",
  "wellsfargo.com", "chase.com", "citi.com", "citibank.com",
  "americanexpress.com", "amex.com", "visa.com", "mastercard.com",
  "paypal.com", "discover.com",
  "goldmansachs.com", "morganstanley.com", "blackrock.com",

  // Major SaaS — they have SEO teams already
  "stripe.com", "shopify.com", "atlassian.com",
  "github.com", "gitlab.com",
  "slack.com", "zoom.us", "dropbox.com", "box.com",
  "hubspot.com", "intercom.com", "zendesk.com",
  "notion.so", "figma.com", "canva.com",

  // Carriers / telco
  "att.com", "verizon.com", "tmobile.com", "sprint.com",
  "comcast.com", "comcast.net", "spectrum.com",

  // Auto / industrial
  "ford.com", "gm.com", "toyota.com", "honda.com", "bmw.com",
  "mercedes-benz.com",
]);

// Local-parts that are clearly automated / noreply — never address
// these even at otherwise-valid domains.
const BLOCKED_LOCAL_PARTS = new Set<string>([
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "mailer-daemon", "postmaster", "abuse",
]);

/**
 * Returns the reason an email is blocked, or null if it's allowed.
 * Reason is suitable for logging / audit trails.
 */
export function emailBlockReason(address: string): string | null {
  const a = address.trim().toLowerCase();
  if (!a.includes("@")) return "malformed (no @)";

  const [local, domain] = a.split("@", 2);
  if (!local || !domain) return "malformed";

  if (BLOCKED_LOCAL_PARTS.has(local)) {
    return `local-part blocklisted: ${local}@`;
  }

  // Strip subdomain so contact@store.amazon.com still matches amazon.com.
  // Walk from longest to shortest match.
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (BLOCKED_DOMAINS.has(candidate)) {
      return `domain blocklisted: ${candidate}`;
    }
  }
  return null;
}

export function isEmailBlocked(address: string): boolean {
  return emailBlockReason(address) !== null;
}
