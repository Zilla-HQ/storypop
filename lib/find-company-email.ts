import * as cheerio from "cheerio";

const EMAIL_RX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Skip mailboxes that are almost never the right person to cold-email.
const BLOCK_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "abuse",
  "unsubscribe",
  "privacy",
  "dmca",
  "legal",
  "press",
  "media",
  "jobs",
  "careers",
  "recruiting",
  "wordpress",
  "example",
  "test",
  // Catches site-template defaults: donations, billing, fundraising
  "donations",
  "donate",
  "billing",
  "accounting",
  "ar",
  "ap",
  "user",
  "you",
  "name",
];

// Catch literal placeholders that ship in marketing templates.
const BLOCK_FULL_EMAILS = new Set([
  "user@domain.com",
  "you@example.com",
  "name@email.com",
  "name@domain.com",
  "email@domain.com",
  "email@example.com",
  "your@email.com",
]);

const BLOCK_DOMAINS = [
  "example.com",
  "example.org",
  "sentry.io",
  "ingest.sentry.io",
  "datadog.com",
  "newrelic.com",
  "wixpress.com",
  "shopify.com",
  "squarespace.com",
  "wordpress.com",
  "godaddy.com",
  "bugsnag.com",
];

// Common pages that hold a real human email if the homepage doesn't.
const CANDIDATE_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/staff",
  "/leadership",
  "/our-story",
  "/get-in-touch",
  "/say-hello",
  "/reach-out",
];

// When scraping yields nothing, try these guessed mailboxes against the
// site's own domain (with MX validation). For local SMBs, info@/hello@/
// contact@ on their own domain is overwhelmingly likely to exist and
// reach the owner.
const FALLBACK_LOCALS = ["info", "hello", "contact"];

interface CandidateScore {
  email: string;
  rank: number;
}

function isBlocked(email: string): boolean {
  const lower = email.toLowerCase();
  if (BLOCK_FULL_EMAILS.has(lower)) return true;
  const [localPart, domain] = lower.split("@");
  if (!domain) return true;
  if (BLOCK_DOMAINS.includes(domain)) return true;
  // Subdomain check: catch error-tracker / observability-vendor mailboxes
  // like *.ingest.sentry.io that web apps log to.
  for (const blocked of BLOCK_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  for (const p of BLOCK_PREFIXES) {
    if (localPart === p || localPart.startsWith(`${p}+`)) return true;
  }
  // Also block hex-only locals (32+ chars) — those are always machine
  // identifiers, never humans.
  if (/^[a-f0-9]{32,}$/.test(localPart)) return true;
  return false;
}

function scoreEmail(email: string, source: "mailto" | "body" | "footer", siteOrigin: string): number {
  let score = 0;
  if (source === "mailto") score += 30; // explicit, hyperlinked
  if (source === "footer") score += 10;
  // Same-domain email > generic gmail. Cold outreach to gmail.com almost
  // never reaches a decision-maker.
  try {
    const [, emailDomain] = email.split("@");
    const siteHost = new URL(siteOrigin).hostname.replace(/^www\./, "");
    if (emailDomain.toLowerCase() === siteHost) score += 50;
    else if (siteHost.endsWith(emailDomain)) score += 30;
  } catch {
    /* ignore */
  }
  // Decision-maker prefixes get a small bump.
  const local = email.toLowerCase().split("@")[0];
  if (local === "hello" || local === "contact" || local === "info") score += 5;
  if (local === "ceo" || local === "founders" || local === "team") score += 7;
  return score;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SitebeatBot/1.0)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function harvestFromHtml(html: string, siteOrigin: string): CandidateScore[] {
  const $ = cheerio.load(html);
  const candidates: CandidateScore[] = [];
  const seen = new Set<string>();

  // Pass 1: explicit mailto: links — highest signal.
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (!m || isBlocked(m) || seen.has(m)) return;
    seen.add(m);
    candidates.push({ email: m, rank: scoreEmail(m, "mailto", siteOrigin) });
  });

  // Pass 2: footer text — usually has the real ops email.
  const footerText = $("footer").text();
  for (const m of footerText.matchAll(EMAIL_RX)) {
    const e = m[0].toLowerCase();
    if (isBlocked(e) || seen.has(e)) continue;
    seen.add(e);
    candidates.push({ email: e, rank: scoreEmail(e, "footer", siteOrigin) });
  }

  // Pass 3: any email anywhere in body text (lowest signal).
  const bodyText = $("body").text();
  for (const m of bodyText.matchAll(EMAIL_RX)) {
    const e = m[0].toLowerCase();
    if (isBlocked(e) || seen.has(e)) continue;
    seen.add(e);
    candidates.push({ email: e, rank: scoreEmail(e, "body", siteOrigin) });
  }

  return candidates;
}

/**
 * Given a site URL, scrape it (and a few common contact pages) to find
 * the most likely human-readable contact email. If scraping yields
 * nothing, try common mailbox guesses (info@/hello@/contact@<domain>)
 * against the site's own domain — only returns one if the domain's MX
 * records exist (validated by caller before sending).
 */
export async function findCompanyEmail(siteUrl: string): Promise<string | null> {
  let origin: string;
  let host: string;
  try {
    const u = new URL(siteUrl);
    origin = u.origin;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  const all: CandidateScore[] = [];

  // Always scrape the homepage first.
  const home = await fetchHtml(origin);
  if (home) all.push(...harvestFromHtml(home, origin));

  // If we already have a strong same-domain candidate, stop early.
  const hasStrong = all.some((c) => c.rank >= 50);
  if (!hasStrong) {
    for (const path of CANDIDATE_PATHS) {
      const html = await fetchHtml(origin + path);
      if (!html) continue;
      const harvested = harvestFromHtml(html, origin);
      all.push(...harvested);
      if (harvested.some((c) => c.rank >= 50)) break;
    }
  }

  if (all.length > 0) {
    all.sort((a, b) => b.rank - a.rank);
    return all[0].email;
  }

  // Scraping yielded nothing. Common-pattern fallback for SMBs: info@<domain>
  // is the de-facto standard for local businesses. Caller's MX validation
  // catches non-existent mailboxes.
  if (host && host.includes(".")) {
    return `${FALLBACK_LOCALS[0]}@${host}`;
  }
  return null;
}
