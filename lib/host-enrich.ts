import { env } from "@/lib/env";
import { findHostEmailViaWebSearch } from "@/lib/claude";

/**
 * Host email enrichment pipeline.
 *
 * Airbnb proxies all host contact, so we can never get host emails directly
 * from a scraped listing. The pipeline below tries each step in order and
 * takes first hit. Realistic match rate: 25–40% on single-property hosts,
 * 60–80% on multi-listing hosts (they have business websites).
 *
 * Steps (executed in order, first hit wins):
 *   1. text_email     — direct email regex against title + description + host bio + highlights
 *   2. text_domain    — domain regex against same surfaces → Hunter domain-search
 *   3. business_name  — host name looks like a business (LLC, Properties, Rentals…) → Hunter company-search
 *   4. claude_search  — Claude w/ web_search tool, gated to plausibly-business hosts
 *   5. str_permit     — county short-term-rental registries (NYC/SF/Nashville/Austin)  [TODO]
 *   6. reverse_image  — reverse image search of listing photos → PM company website   [TODO]
 *
 * Returns the email and which step found it (used for outreach copy + funnel
 * analytics). hostEmailSource is persisted on listings.host_email_source.
 */

export interface EnrichmentResult {
  email: string;
  source:
    | "description_regex"
    | "hunter"
    | "hunter_company"
    | "claude_search"
    | "str_permit_registry"
    | "reverse_image"
    | "airbnb_form"
    | "manual";
}

export async function enrichHostEmail(args: {
  hostName?: string | null;
  city: string;
  state: string;
  scrapedTitle?: string | null;
  scrapedDescription?: string | null;
  hostAbout?: string | null;
  hostHighlights?: string[] | null;
  listingPhotos?: string[];
  airbnbListingUrl?: string | null;
}): Promise<EnrichmentResult | null> {
  // Aggregate every text surface that might contain contact info into one
  // searchable corpus. Order matters only for which the regex hits first;
  // we extract from the union.
  const corpus = [
    args.scrapedTitle ?? "",
    args.scrapedDescription ?? "",
    args.hostAbout ?? "",
    ...(args.hostHighlights ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  // Step 1: direct email regex
  const directEmail = extractEmail(corpus);
  if (directEmail) return { email: directEmail, source: "description_regex" };

  // Step 2: domain regex → Hunter domain-search
  const domain = extractDomain(corpus);
  if (domain) {
    const hunterEmail = await hunterDomainSearch(domain, args.hostName ?? undefined);
    if (hunterEmail) return { email: hunterEmail, source: "hunter" };
  }

  // Step 3: business-named hosts (LLC, Properties, Rentals, Stays, Hospitality)
  // → Hunter company-search resolves company → domain → emails
  if (args.hostName && looksLikeBusinessName(args.hostName)) {
    const hunterEmail = await hunterCompanySearch(args.hostName);
    if (hunterEmail) return { email: hunterEmail, source: "hunter_company" };
  }

  // Step 4: Claude with web_search — plausible-business hosts that Hunter
  // missed. Gated to hosts whose data signals a business presence (multi-word
  // company name, single-word brand-like name, or bio containing "Owner of X"
  // / "I run X"). We never burn this on personal hosts named "Greg" with no
  // business signal — wasted spend at $0.05/call.
  if (args.hostName && plausiblyBusiness(args.hostName, args.hostAbout, args.hostHighlights)) {
    const claudeMatch = await findHostEmailViaWebSearch({
      hostName: args.hostName,
      city: args.city,
      state: args.state,
      listingUrl: args.airbnbListingUrl,
      hostAbout: args.hostAbout,
    });
    if (claudeMatch) return { email: claudeMatch.email, source: "claude_search" };
  }

  // Step 5: STR permit registry — TODO
  // Step 6: reverse image search — TODO

  return null;
}

const PERSONAL_FIRST_NAMES = new Set([
  "greg","amy","john","mary","bob","susan","tom","kim","liz","dan","ben","sarah",
  "mike","jen","jenny","amanda","bre","kimberly","sophia","alex","alexandrea","leann","pam",
  "victor","traci","james","kevin","ashley","jessica","mary","laura","jason","stephanie",
  "alan","eric","brian","steve","steven","jordan","justin","gabriel","star","taylor",
]);

const BUSINESS_BIO_PATTERNS = [
  /\bowner of\s+[A-Z]/,
  /\bi (?:run|own|founded|manage)\s+[A-Z]/,
  /\bmy (?:business|company|brand)\b/i,
  /\bproperty management\b/i,
  /\bvacation rental(?:s)?\b/i,
  /\bhost(?:s|ing) (?:a |multiple |many )?(?:portfolio|properties)/i,
];

const BRANDY_SINGLE_WORD = /^[A-Z][a-z]*[A-Z][a-zA-Z]+$|^[A-Z][a-z]+(?:well|stay|stays|nest|nook|place|properties?)$/i;

/**
 * Worth burning a Claude web_search call on this host? Heuristic — we
 * accept false positives (cost: $0.05) but try to skip obvious personal
 * accounts.
 */
function plausiblyBusiness(
  hostName: string,
  hostAbout?: string | null,
  hostHighlights?: string[] | null,
): boolean {
  const tokens = hostName.toLowerCase().trim().split(/\s+/);

  // Multi-word with business token (already covered by hunterCompanySearch
  // upstream, so this only fires when Hunter returned nothing).
  if (looksLikeBusinessName(hostName)) return true;

  // Single-word brand-y names like "Lodgewell", "StayAustin", "NestATX".
  if (tokens.length === 1 && BRANDY_SINGLE_WORD.test(hostName) && !PERSONAL_FIRST_NAMES.has(tokens[0])) {
    return true;
  }

  // Bio mentions a business
  const corpus = `${hostAbout ?? ""}\n${(hostHighlights ?? []).join("\n")}`;
  if (BUSINESS_BIO_PATTERNS.some((re) => re.test(corpus))) return true;

  return false;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const DOMAIN_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/i;
const SOCIAL_DOMAIN_BLACKLIST = new Set([
  "airbnb.com",
  "airbnb.co",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "yelp.com",
  "tripadvisor.com",
  "vrbo.com",
  "booking.com",
  "google.com",
  "muscache.com",
]);

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : null;
}

function extractDomain(text: string): string | null {
  // findAll, take first non-blacklisted domain
  const re = new RegExp(DOMAIN_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const d = m[1].toLowerCase();
    if (!SOCIAL_DOMAIN_BLACKLIST.has(d)) return d;
  }
  return null;
}

const BUSINESS_NAME_TOKENS = [
  "llc",
  "inc",
  "ltd",
  "co",
  "corp",
  "company",
  "properties",
  "property",
  "rental",
  "rentals",
  "stays",
  "stay",
  "hospitality",
  "hosts",
  "vacation",
  "homes",
  "estates",
  "lodge",
  "lodging",
  "retreat",
  "retreats",
  "group",
  "&",
  "and",
];

function looksLikeBusinessName(name: string): boolean {
  const lower = name.toLowerCase();
  // Multi-word names with at least one business-y token are very likely a
  // company. Single-word "Greg" is not. "Sinai Rental Properties LLC" is.
  const tokens = lower.split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.some((t) =>
    BUSINESS_NAME_TOKENS.some(
      (b) => t === b || t === `${b}.` || t === `${b},`,
    ),
  );
}

async function hunterDomainSearch(domain: string, hostName?: string): Promise<string | null> {
  const apiKey = env("HUNTER_API_KEY");
  if (!apiKey) return null;
  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", "5");
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      data?: { emails?: Array<{ value: string; first_name?: string; last_name?: string; type?: string }> };
    };
    return pickBestEmail(data.data?.emails, hostName);
  } catch {
    return null;
  }
}

async function hunterCompanySearch(companyName: string): Promise<string | null> {
  const apiKey = env("HUNTER_API_KEY");
  if (!apiKey) return null;
  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("company", companyName);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", "5");
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      data?: { emails?: Array<{ value: string; first_name?: string; last_name?: string; type?: string }> };
    };
    return pickBestEmail(data.data?.emails);
  } catch {
    return null;
  }
}

function pickBestEmail(
  emails: Array<{ value: string; first_name?: string; last_name?: string; type?: string }> | undefined,
  hostName?: string,
): string | null {
  if (!emails || emails.length === 0) return null;
  if (hostName) {
    const first = hostName.split(/\s+/)[0]?.toLowerCase();
    if (first) {
      const match = emails.find(
        (e) => e.first_name?.toLowerCase() === first || e.value.toLowerCase().includes(first),
      );
      if (match) return match.value.toLowerCase();
    }
  }
  const personal = emails.find((e) => e.type === "personal");
  return (personal ?? emails[0]).value.toLowerCase();
}
