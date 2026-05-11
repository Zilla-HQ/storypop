import * as cheerio from "cheerio";

const SOCIAL_HOSTS = [
  // Social media + community
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "github.com",
  "gist.github.com",
  "medium.com",
  "substack.com",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "github.io",
  "wikipedia.org",
  "wikimedia.org",
  "google.com",
  "maps.google.com",
  "goo.gl",
  "youtube-nocookie.com",
  "amazon.com",
  "wa.me",
  "t.me",
  "discord.gg",
  "discord.com",
  "patreon.com",
  // Reservation / booking / delivery platforms — never the restaurant's actual site
  "opentable.com",
  "opentable.co.uk",
  "resy.com",
  "exploretock.com",
  "tock.com",
  "sevenrooms.com",
  "tableagent.com",
  "yelp.com",
  "tripadvisor.com",
  "doordash.com",
  "ubereats.com",
  "grubhub.com",
  "seamless.com",
  "caviar.com",
  "postmates.com",
  "toasttab.com",
  "chownow.com",
  "safegraph.com",
  "ezcater.com",
  "squareup.com",
  "square.site",
  // Generic content / pinning
  "pinterest.com",
  "pinterest.co.uk",
  "behance.net",
  "dribbble.com",
  "tumblr.com",
  "blogspot.com",
  // Booking / scheduling
  "calendly.com",
  "acuityscheduling.com",
];

const TRACKER_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_/i,
  /^ref=/i,
];

function sameRegistrableDomain(host: string, sourceHost: string): boolean {
  // crude eTLD+1: take last two labels (good enough for .com / .org / .net /
  // .nyc; misses .co.uk style but those are uncommon for our directory pages).
  const tail = (h: string) => h.split(".").slice(-2).join(".");
  return tail(host) === tail(sourceHost);
}

function looksLikeCompanySite(absUrl: string, sourceHost: string): boolean {
  let u: URL;
  try {
    u = new URL(absUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host === sourceHost) return false; // exact intra-site link
  // Filter ANY subdomain of the source (eater.com → assets.eater.com,
  // platform.eater.com, voxmedia.com which is the parent of eater.com).
  if (sourceHost && sameRegistrableDomain(host, sourceHost)) return false;
  for (const blocked of SOCIAL_HOSTS) {
    if (host === blocked || host.endsWith(`.${blocked}`)) return false;
  }
  // Also block parent / sister network domains
  const networkParents = ["voxmedia.com", "timeout.group", "tronc.com", "advance.net", "hearst.com"];
  for (const p of networkParents) {
    if (host === p || host.endsWith(`.${p}`)) return false;
  }
  // Skip subdomain-of-platform style URLs (e.g. *.notion.site, *.framer.website)
  if (/\.(notion\.site|framer\.website|framer\.app|webflow\.io|carrd\.co|wordpress\.com|wixsite\.com|squarespace\.com)$/.test(host)) return false;
  return true;
}

function stripTrackers(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const params = Array.from(u.searchParams.keys());
    for (const p of params) {
      if (TRACKER_PATTERNS.some((rx) => rx.test(p))) u.searchParams.delete(p);
    }
    // Normalize to origin (drop path) — outreach wants the canonical site,
    // not deep links.
    return u.origin;
  } catch {
    return rawUrl;
  }
}

/**
 * Given a directory/listing/article URL, fetch it and extract every
 * outbound link that looks like a candidate company site. Returns
 * deduped origin-only URLs.
 *
 * Caller is expected to feed these into the outreach pipeline (which
 * handles email-finding + audit + cold-email per target).
 */
export async function extractSiteUrls(seedUrl: string, maxResults = 30): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(seedUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SitebeatBot/1.0)" },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);
  let sourceHost = "";
  try {
    sourceHost = new URL(res.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    /* ignore */
  }

  const unique = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    let abs: string;
    try {
      abs = new URL(href, res.url).toString();
    } catch {
      return;
    }
    if (!looksLikeCompanySite(abs, sourceHost)) return;
    const origin = stripTrackers(abs);
    unique.add(origin);
  });

  return Array.from(unique).slice(0, maxResults);
}
