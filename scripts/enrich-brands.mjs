/**
 * Brand-name enrichment for multi-listing hosts on Airbnb.
 *
 * Many multi-listing hosts are STR companies (AvantStay, Vacasa, Kasa, etc.)
 * whose Airbnb display name maps cleanly to a public website. We guess the
 * domain from the host name and verify via Hunter.io.
 *
 * Run:
 *   node --env-file=.env.local scripts/enrich-brands.mjs
 *
 * Output: list of (host, listings, guessed domain, real email from Hunter)
 */
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const HUNTER_KEY = process.env.HUNTER_API_KEY;
if (!APIFY_TOKEN || !HUNTER_KEY) throw new Error("env missing");

const RUN_IDS = [
  "OqeXeVFShjP0MHx7U", "abKasfHQeOgV84DUL", "dFXAnTFU6rzPiavxE",
  "DWcMbXJEf17cpTNw2", "CeJZ7epKB9RzQ44e4", "Vg6yhggFWCp8FfID7", "fp0UfX3aDFSIXXclq",
];

const STOP_WORDS = new Set([
  "nashville", "austin", "asheville", "scottsdale", "joshua", "tree", "tn", "tx", "az", "nc", "ca",
  "the", "and", "of", "co", "llc", "inc", "vacations", "vacation", "rental", "rentals", "stays",
  "vrbo", "airbnb", "ash",
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

/**
 * Guess candidate domains from a host name like "AvantStay Nashville" or
 * "Beckon Homes" or "Steve From Misfit Homes".
 *
 * Strategy: strip city/qualifier words, take the meaningful brand tokens,
 * try a few permutations: full string, first word, two words concatenated.
 */
function guessDomains(hostName) {
  if (!hostName) return [];
  const tokens = hostName
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  const out = new Set();
  if (tokens.length >= 1) out.add(tokens[0] + ".com");
  if (tokens.length >= 2) {
    out.add(tokens.slice(0, 2).join("") + ".com");
    out.add(tokens.slice(0, 2).join("-") + ".com");
  }
  if (tokens.length === 1) {
    out.add(tokens[0] + ".com");
  } else if (tokens.length >= 3 && hostName.toLowerCase().includes("from")) {
    // "Steve From Misfit Homes" → misfit.com / misfithomes.com
    const idx = tokens.indexOf("from");
    if (idx >= 0 && idx < tokens.length - 1) {
      out.add(tokens[idx + 1] + ".com");
      if (tokens[idx + 2]) out.add(tokens[idx + 1] + tokens[idx + 2] + ".com");
    }
  }
  return [...out];
}

async function dnsExists(domain) {
  try {
    const r = await fetch(`https://${domain}`, { method: "HEAD", redirect: "follow" });
    return r.ok || (r.status >= 300 && r.status < 500); // anything not 5xx/connection-refused is "exists"
  } catch {
    return false;
  }
}

async function hunterSearch(domain) {
  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", HUNTER_KEY);
    url.searchParams.set("limit", "5");
    const r = await fetch(url, { method: "GET" });
    if (!r.ok) return [];
    const data = await r.json();
    return data?.data?.emails ?? [];
  } catch { return []; }
}

async function main() {
  const items = await fetchAll();
  const hostsByName = new Map();
  for (const it of items) {
    const name = it.host?.name;
    if (!name) continue;
    if (!hostsByName.has(name)) hostsByName.set(name, []);
    hostsByName.get(name).push(it);
  }
  // Multi-listing only
  const multi = [...hostsByName.entries()]
    .filter(([, ls]) => ls.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`multi-listing hosts: ${multi.length}\n`);

  const HUNTER_BUDGET = 30;
  let hunterCalls = 0;
  let hits = 0;
  const found = [];

  for (const [name, listings] of multi) {
    if (hunterCalls >= HUNTER_BUDGET) break;
    const domains = guessDomains(name);
    if (domains.length === 0) continue;

    let bestEmail = null;
    let bestDomain = null;
    for (const d of domains) {
      const exists = await dnsExists(d);
      if (!exists) continue;
      hunterCalls++;
      const emails = await hunterSearch(d);
      if (emails.length > 0) {
        bestEmail = emails[0].value;
        bestDomain = d;
        break;
      }
      if (hunterCalls >= HUNTER_BUDGET) break;
    }
    if (bestEmail) {
      hits++;
      found.push({ name, listings: listings.length, domain: bestDomain, email: bestEmail });
      console.log(`  ✓ ${name} (${listings.length}× listings) → ${bestDomain} → ${bestEmail}`);
    } else {
      console.log(`  ✗ ${name} (${listings.length}× listings) → tried [${domains.join(", ")}]`);
    }
  }

  console.log(`\nused ${hunterCalls} Hunter searches`);
  console.log(`found: ${hits} hosts with real emails (${found.reduce((sum, f) => sum + f.listings, 0)} listings represented)`);
  console.log(`\nresult JSON for follow-up batch send:`);
  console.log(JSON.stringify(found, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
