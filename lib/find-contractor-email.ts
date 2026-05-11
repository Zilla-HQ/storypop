import { env } from "@/lib/env";

const APIFY = env("APIFY_TOKEN");

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const SKIP_DOMAINS = [
  "yelp.com",
  "yelpcdn.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "google.com",
  "googleapis.com",
  "bbb.org",
  "homeadvisor.com",
  "thumbtack.com",
  "angi.com",
  "yellowpages.com",
  "manta.com",
  "wikipedia.org",
  "indeed.com",
  "glassdoor.com",
  // Real-estate aggregators + MLS infrastructure — emails on these domains are
  // never the actual agent / brokerage; they're support / DMCA / copyright
  // mailboxes that flag spam complaints.
  "realtor.com",
  "zillow.com",
  "redfin.com",
  "trulia.com",
  "homes.com",
  "mlsgrid.com",
  "mlslistings.com",
  "mlsmatrix.com",
  "mls.com",
  "agentfire.com",
  "easyagentpro.com",
  "idx.com",
  "ihomefinder.com",
  "kvcore.com",
  "boomtownroi.com",
];

/**
 * Recipient-domain denylist for cold sending. These domains showed up in
 * historical sends as aggregator-support / MLS-infrastructure inboxes that
 * (a) aren't the real recipient and (b) generate spam complaints. We
 * extract them when scraping but never USE them as the to-address.
 */
const BLOCKED_RECIPIENT_DOMAINS = new Set([
  "realtor.com",
  "zillow.com",
  "redfin.com",
  "trulia.com",
  "homes.com",
  "mlsgrid.com",
  "mlslistings.com",
  "mlsmatrix.com",
  "mls.com",
  "agentfire.com",
  "easyagentpro.com",
  "idx.com",
  "ihomefinder.com",
  "kvcore.com",
  "boomtownroi.com",
  "sentry.io",
  "wixpress.com",
  "googleapis.com",
  // Operator's own forwarding domain — never cold-email ourselves
  "seifdn.org",
]);

function looksLikeContractorSite(url: string): boolean {
  try {
    const u = new URL(url);
    return !SKIP_DOMAINS.some((d) => u.hostname.endsWith(d));
  } catch {
    return false;
  }
}

/**
 * Replace HTML tags + entities with spaces before regex-extracting emails.
 * Without this, adjacent-element text bleeds together: e.g. an HTML page with
 *   <p>Phone: 756-5592</p><p>Email: info@example.com</p>
 * collapses (after stripping whitespace via the email regex's tolerant local-
 * part charset) into "756-5592info@example.com" — a syntactically valid
 * email-with-bogus-local-part that bounces in production. Inserting spaces at
 * every tag boundary keeps element text separated.
 */
function cleanHtmlForEmailExtraction(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/g, " ");
}

/** Strip a phone-number-style digit prefix that got mashed onto the local
 *  part when the source had no whitespace between phone + email. */
function trimPhonePrefix(local: string): string {
  // Phone-prefix patterns we've seen: "7565592info", "5125551212contact",
  // "(512)555info" (parens already stripped by regex). Look for 5+ digits
  // optionally with separators, followed by a known business-mailbox word.
  const m = local.match(/^[\d\-.()]{5,}(info|contact|hello|sales|support|office|admin|hi|inquiries|help)$/i);
  return m ? m[1] : local;
}

function extractEmails(text: string, ownerDomain?: string): string[] {
  const cleaned = cleanHtmlForEmailExtraction(text);
  const matches = cleaned.match(EMAIL_RE) ?? [];
  const norm = matches
    .map((e) => e.toLowerCase())
    .map((e) => {
      const at = e.lastIndexOf("@");
      if (at < 0) return e;
      return trimPhonePrefix(e.slice(0, at)) + e.slice(at);
    })
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff)$/i.test(e))
    .filter((e) => !e.startsWith("wixpress") && !e.startsWith("sentry"))
    .filter((e) => !e.includes("@u003c") && !e.includes("@example"))
    .filter((e) => !e.endsWith("@2x") && !e.endsWith("@3x"))
    // Reject if the local-part is still phone-shaped after trimming
    .filter((e) => !/^[\d\-.()+]+@/.test(e))
    // Reject aggregator / MLS-infrastructure / operator-self domains
    .filter((e) => {
      const at = e.lastIndexOf("@");
      if (at < 0) return false;
      const domain = e.slice(at + 1).toLowerCase();
      // Match exact domain or any subdomain (e.g. "support.realtor.com")
      for (const blocked of BLOCKED_RECIPIENT_DOMAINS) {
        if (domain === blocked || domain.endsWith(`.${blocked}`)) return false;
      }
      return true;
    });
  const unique = [...new Set(norm)];
  if (!ownerDomain) return unique;
  // Prefer emails that match the contractor's own domain.
  const onDomain = unique.filter((e) => e.endsWith(`@${ownerDomain}`));
  return onDomain.length > 0 ? onDomain : unique;
}

async function fetchTextSafe(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RealscaleBot/1.0; +https://realscale.app)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Use Apify's Google Search scraper to find candidate URLs for a query.
 * Returns up to N organic-result URLs.
 */
async function googleSearchUrls(query: string, max = 8): Promise<string[]> {
  if (!APIFY) return [];
  const url = `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
    APIFY,
  )}&timeout=120`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: query,
        maxPagesPerQuery: 1,
        resultsPerPage: max,
        countryCode: "us",
        languageCode: "en",
      }),
      // Apify returns the dataset items; the actor finishes within timeout for a single query.
    });
    if (!res.ok) return [];
    const items = (await res.json()) as Array<{
      organicResults?: Array<{ url?: string }>;
    }>;
    const urls: string[] = [];
    for (const it of items) {
      for (const r of it.organicResults ?? []) {
        if (r.url) urls.push(r.url);
      }
    }
    return urls.slice(0, max);
  } catch {
    return [];
  }
}

export interface ContractorContact {
  email: string | null;
  website: string | null;
  source: "yelp_page" | "google_search" | null;
}

/**
 * Best-effort autonomous contractor email discovery.
 *
 * Tier 1: fetch the contractor's Yelp profile page and regex-extract any
 *         exposed email or website link. Many contractors put a "Visit
 *         Website" link on their Yelp profile, which we then scrape.
 * Tier 2: Apify Google Search → first non-directory, non-social URL → fetch
 *         homepage + /contact + /about → regex email.
 *
 * Returns null email if nothing is found. Caller should treat null as
 * "needs alternate intro path" (don't bug the operator about it — the
 * contractor_intros row stays in queued status and the next iteration of
 * the matching agent can retry, or a future contractor portal handles it).
 */
export async function findContractorContact(args: {
  name: string;
  city: string;
  state: string;
  yelpUrl: string | null;
}): Promise<ContractorContact> {
  // -------- Tier 1: scrape Yelp profile for website link --------
  let website: string | null = null;
  if (args.yelpUrl) {
    const yelpHtml = await fetchTextSafe(args.yelpUrl);
    if (yelpHtml) {
      // Yelp redirects external clicks through /biz_redir?url=…; pull the
      // actual contractor URL from that param.
      const redir = yelpHtml.match(
        /href="\/biz_redir\?url=([^&"]+)[^"]*"[^>]*>[^<]*website/i,
      );
      if (redir?.[1]) {
        try {
          website = decodeURIComponent(redir[1]);
        } catch {
          /* ignore */
        }
      }
      // Some pages embed the URL plainly.
      if (!website) {
        const plain = yelpHtml.match(
          /https?:\/\/(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s"<]*)?/gi,
        );
        if (plain) {
          website = plain.find(
            (u) =>
              looksLikeContractorSite(u) &&
              !u.includes("yelp-search-cache") &&
              !u.includes("/biz/"),
          ) ?? null;
        }
      }
    }
  }

  // -------- Tier 2: Google search via Apify --------
  if (!website) {
    const candidates = await googleSearchUrls(
      `${args.name} ${args.city} ${args.state}`,
      8,
    );
    website = candidates.find(looksLikeContractorSite) ?? null;
  }

  if (!website) {
    return { email: null, website: null, source: null };
  }

  // -------- Fetch homepage + likely contact pages --------
  let ownerDomain: string | undefined;
  try {
    ownerDomain = new URL(website).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }

  const tryUrls = [website];
  try {
    const u = new URL(website);
    tryUrls.push(`${u.origin}/contact`, `${u.origin}/contact-us`, `${u.origin}/about`);
  } catch {
    /* ignore */
  }

  const pages = await Promise.all(tryUrls.map((u) => fetchTextSafe(u)));
  const allText = pages.join(" ");

  const emails = extractEmails(allText, ownerDomain);
  if (emails.length === 0) {
    return { email: null, website, source: args.yelpUrl ? "yelp_page" : "google_search" };
  }

  // Prefer common business-mailbox prefixes.
  const preferredPrefixes = ["info", "contact", "hello", "office", "sales", "support"];
  const ranked = [...emails].sort((a, b) => {
    const aRank = preferredPrefixes.findIndex((p) => a.startsWith(`${p}@`));
    const bRank = preferredPrefixes.findIndex((p) => b.startsWith(`${p}@`));
    if (aRank === -1 && bRank === -1) return 0;
    if (aRank === -1) return 1;
    if (bRank === -1) return -1;
    return aRank - bRank;
  });

  return {
    email: ranked[0],
    website,
    source: args.yelpUrl ? "yelp_page" : "google_search",
  };
}
