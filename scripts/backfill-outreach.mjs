/**
 * Backfill the 5 listings + outreach_events from the demo batch we just sent,
 * so /admin/outreach shows real activity.
 *
 * Run:
 *   node --env-file=.env.local scripts/backfill-outreach.mjs
 */
import postgres from "postgres";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
if (!APIFY_TOKEN || !DATABASE_URL) throw new Error("env missing");

const sql = postgres(DATABASE_URL, { connect_timeout: 12, max: 1, prepare: false });

// Map of (resend_id, runId, listingId) for the 5 emails we just sent
const SENT_EMAILS = [
  { resendId: "884d6a22-a672-46b4-bf46-26ed875fbc10", host: "Scarlett",          subject: "Nashville, Tennessee — your free 60-second Airbnb audit" },
  { resendId: "ddf94de0-1785-4749-b304-d33665b3d505", host: "Lily And Jordan",   subject: "Nashville, Tennessee — your free 60-second Airbnb audit" },
  { resendId: "0b41197d-315a-4440-8b47-830cc823fd48", host: "Benjamin",          subject: "Nashville, Tennessee — your free 60-second Airbnb audit" },
  { resendId: "da8dac41-667e-4fb3-8b10-1b297641bd75", host: "Andrew",            subject: "Nashville, Tennessee — your free 60-second Airbnb audit" },
  { resendId: "6130fa64-2d30-4129-8f6c-2d95914f313b", host: "Christie",          subject: "Ashland City, Tennessee — your free 60-second Airbnb audit" },
];

const RUN_IDS = [
  "OqeXeVFShjP0MHx7U", "abKasfHQeOgV84DUL", "dFXAnTFU6rzPiavxE",
  "DWcMbXJEf17cpTNw2", "CeJZ7epKB9RzQ44e4", "Vg6yhggFWCp8FfID7", "fp0UfX3aDFSIXXclq",
];

const STATES = {
  Tennessee: "TN", Texas: "TX", California: "CA", "North Carolina": "NC", Arizona: "AZ",
};

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
function extractNightlyCents(item) {
  const m = (item.price?.breakDown?.basePrice?.description || "").match(/\$([\d,]+(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1].replace(/,/g, "")) * 100) : 0;
}

async function fetchAllListings() {
  const seen = new Map();
  for (const runId of RUN_IDS) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(APIFY_TOKEN)}`);
    if (!res.ok) continue;
    const items = await res.json();
    for (const it of items) {
      const id = String(it.id || it.listingId || "");
      if (!id || seen.has(id)) continue;
      if (!it.images?.[0]?.imageUrl) continue;
      seen.set(id, it);
    }
  }
  return [...seen.values()];
}

async function main() {
  const items = await fetchAllListings();
  console.log("unique listings available:", items.length);

  const itemsByHost = new Map();
  for (const it of items) {
    const host = it.host?.name;
    if (host && !itemsByHost.has(host)) itemsByHost.set(host, it);
  }

  // Insert each of the 5 sent + their listing
  for (const sent of SENT_EMAILS) {
    const item = itemsByHost.get(sent.host);
    if (!item) { console.log("  ✗ no item for", sent.host); continue; }

    const id = String(item.id);
    const city = item.location || "";
    const stateName = (item.locationSubtitle || "").split(",")[1]?.trim() || "";
    const state = STATES[stateName] ?? stateName.slice(0, 2).toUpperCase();
    const photos = (item.images || []).map((p) => p.imageUrl).filter(Boolean);
    const nightlyCents = extractNightlyCents(item);
    const title = item.title || item.seoTitle || item.sharingConfigTitle;
    const desc = item.description || item.metaDescription;
    const slug = `${slugify(`${city} ${id}`)}-${id.slice(-6)}`;
    const roomType = (item.roomType || "").toLowerCase();
    const listingType = roomType.includes("entire") ? "entire_home" : roomType.includes("private") ? "private_room" : "other";

    const u = (v) => (v === undefined ? null : v);
    const [listing] = await sql`
      INSERT INTO restay.listings (
        source, source_id, mls_id, address, city, state, zip, price, listing_type,
        photos, agent_name, listing_url, scraped_title, scraped_description,
        review_count, avg_rating, is_superhost, guest_capacity, slug
      ) VALUES (
        'airbnb', ${id}, ${id}, ${u(city)}, ${u(city)}, ${u(state)}, '', ${u(nightlyCents)}, ${u(listingType)},
        ${JSON.stringify(photos)}::jsonb, ${u(item.host?.name)}, ${u((item.url || "").split("?")[0])},
        ${u(title)}, ${u(desc)}, ${u(item.rating?.reviewsCount)}, ${u(item.rating?.guestSatisfaction)},
        ${!!item.host?.isSuperHost}, ${u(item.personCapacity)}, ${slug}
      )
      ON CONFLICT (source, source_id) DO UPDATE SET last_seen_at = now()
      RETURNING id
    `;
    console.log(`  ✓ listing ${listing.id} for host ${sent.host} (${city})`);

    await sql`
      INSERT INTO restay.outreach_events (
        listing_id, channel, template_id, sender_domain, subject, body, resend_id, status, sent_at
      ) VALUES (
        ${listing.id}, 'email', 'outreach_v1', 'mail.restay.agency',
        ${sent.subject}, ${"(emailed to jack@seifdn.org as preview)"}, ${sent.resendId},
        'sent', now()
      )
    `;
    console.log(`    ✓ outreach_event resend_id=${sent.resendId}`);
  }
  console.log("\ndone");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
