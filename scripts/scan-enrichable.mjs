/**
 * Scan all 2,288 cached scraped listings for host emails reachable via:
 *   1. Direct email regex in description
 *   2. Domain regex in description → Hunter.io domain search
 *
 * Output: how many of 2,288 hosts we could realistically email.
 *
 * Run:
 *   node --env-file=.env.local scripts/scan-enrichable.mjs
 */
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const HUNTER_KEY = process.env.HUNTER_API_KEY;
if (!APIFY_TOKEN || !HUNTER_KEY) throw new Error("env missing");

const RUN_IDS = [
  "OqeXeVFShjP0MHx7U", "abKasfHQeOgV84DUL", "dFXAnTFU6rzPiavxE",
  "DWcMbXJEf17cpTNw2", "CeJZ7epKB9RzQ44e4", "Vg6yhggFWCp8FfID7", "fp0UfX3aDFSIXXclq",
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const DOMAIN_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi;
const SOCIAL = new Set([
  "airbnb.com", "instagram.com", "facebook.com", "twitter.com", "x.com",
  "tiktok.com", "youtube.com", "linkedin.com", "yelp.com", "tripadvisor.com",
  "vrbo.com", "booking.com", "muscache.com", "google.com", "goo.gl",
  "bit.ly", "youtu.be", "spotify.com", "pinterest.com",
]);

async function fetchAll() {
  const seen = new Map();
  for (const runId of RUN_IDS) {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(APIFY_TOKEN)}`);
    if (!r.ok) continue;
    const items = await r.json();
    for (const it of items) {
      const id = String(it.id || "");
      if (!id || seen.has(id)) continue;
      seen.set(id, it);
    }
  }
  return [...seen.values()];
}

function findEmailIn(text) {
  if (!text) return null;
  const m = text.match(EMAIL_REGEX);
  return m ? m[0].toLowerCase() : null;
}

function findDomainsIn(text) {
  if (!text) return [];
  const out = new Set();
  const seen = new Set();
  for (const m of text.matchAll(DOMAIN_REGEX)) {
    const d = m[1].toLowerCase();
    if (seen.has(d)) continue;
    seen.add(d);
    if (SOCIAL.has(d)) continue;
    if (d.length < 4) continue;
    if (!d.includes(".")) continue;
    out.add(d);
  }
  return [...out];
}

async function hunterSearch(domain, hostFirst) {
  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", HUNTER_KEY);
    url.searchParams.set("limit", "5");
    const r = await fetch(url, { method: "GET" });
    if (!r.ok) return null;
    const data = await r.json();
    const emails = data?.data?.emails ?? [];
    if (emails.length === 0) return null;
    if (hostFirst) {
      const m = emails.find((e) =>
        (e.first_name || "").toLowerCase() === hostFirst.toLowerCase() ||
        (e.value || "").toLowerCase().startsWith(hostFirst.toLowerCase())
      );
      if (m) return m.value;
    }
    return emails[0]?.value ?? null;
  } catch { return null; }
}

async function main() {
  const items = await fetchAll();
  console.log(`scanning ${items.length} unique listings...\n`);

  let multiListingHosts = new Map(); // hostId -> count
  for (const it of items) {
    const hid = it.host?.id;
    if (hid) multiListingHosts.set(hid, (multiListingHosts.get(hid) || 0) + 1);
  }
  const multiCount = [...multiListingHosts.values()].filter((c) => c >= 2).length;
  console.log(`hosts with 2+ listings (likely commercial): ${multiCount}\n`);

  let directEmails = 0;
  let domainsFound = 0;
  const hunterTargets = []; // top candidates to actually run Hunter on
  const HUNTER_BUDGET = 30; // cap to preserve our 50/mo limit

  const seenHosts = new Set();
  for (const it of items) {
    const hid = it.host?.id || it.host?.name;
    if (!hid || seenHosts.has(hid)) continue;
    seenHosts.add(hid);
    const desc = it.description || it.metaDescription || "";
    const email = findEmailIn(desc);
    if (email) {
      directEmails++;
      console.log(`  ✓ direct email: ${it.host?.name} → ${email}`);
      continue;
    }
    const domains = findDomainsIn(desc);
    if (domains.length === 0) continue;
    domainsFound++;
    // Score multi-listing hosts higher
    const listingsForHost = multiListingHosts.get(hid) || 1;
    hunterTargets.push({ hostName: it.host?.name, domains, listingCount: listingsForHost });
  }
  hunterTargets.sort((a, b) => b.listingCount - a.listingCount);

  console.log(`\nunique hosts: ${seenHosts.size}`);
  console.log(`direct emails in description: ${directEmails}`);
  console.log(`hosts with domain in description (Hunter candidates): ${domainsFound}`);
  console.log(`\nrunning Hunter on top ${Math.min(HUNTER_BUDGET, hunterTargets.length)} multi-listing hosts...\n`);

  let hunterHits = 0;
  for (let i = 0; i < Math.min(HUNTER_BUDGET, hunterTargets.length); i++) {
    const { hostName, domains, listingCount } = hunterTargets[i];
    for (const d of domains.slice(0, 1)) {
      const email = await hunterSearch(d, hostName?.split(" ")[0]);
      if (email) {
        hunterHits++;
        console.log(`  ✓ ${hostName} (${listingCount}× listings) → ${d} → ${email}`);
      } else {
        console.log(`  ✗ ${hostName} (${listingCount}× listings) → ${d} → no match`);
      }
      break;
    }
  }
  console.log(`\nHunter hit rate: ${hunterHits}/${Math.min(HUNTER_BUDGET, hunterTargets.length)}`);
  console.log(`Total reachable hosts (estimate): ${directEmails + hunterHits}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
