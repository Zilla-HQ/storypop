/**
 * One-off discovery runner — bypasses Inngest entirely.
 * Calls Apify, normalizes, upserts into Supabase. Identical logic to what
 * inngest/functions/discovery.ts wraps; lets us prove the loop end-to-end
 * without depending on Inngest cloud dispatching.
 *
 * Run:
 *   node --env-file=.env.local scripts/run-discovery-once.mjs
 */
import postgres from "postgres";

const NIGHTLY_MIN_CENTS = 5_000;
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR = process.env.APIFY_AIRBNB_ACTOR ?? "tri_angle/airbnb-scraper";
const CITIES = (process.env.AIRBNB_DISCOVERY_CITIES ?? "austin-tx,nashville-tn")
  .split(",").map((c) => c.trim()).filter(Boolean);
const LIMIT = Number(process.env.AIRBNB_DISCOVERY_LIMIT ?? "10");
const DATABASE_URL = process.env.DATABASE_URL;

if (!APIFY_TOKEN) throw new Error("APIFY_TOKEN missing");
if (!DATABASE_URL) throw new Error("DATABASE_URL missing");

const sql = postgres(DATABASE_URL, { connect_timeout: 12, max: 1, prepare: false });

async function runActor(actorId, input) {
  const id = actorId.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${id}/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}&timeout=540`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify ${actorId} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function formatCity(slug) {
  const parts = slug.split("-");
  if (parts.length < 2) return slug;
  const state = parts[parts.length - 1].toUpperCase();
  const city = parts.slice(0, -1).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
  return `${city}, ${state}`;
}

const STATES = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

function extractNightlyCents(r) {
  const p = r.price;
  if (!p) return 0;
  const bp = p.breakDown && p.breakDown.basePrice;
  if (bp && typeof bp.description === "string") {
    const m = bp.description.match(/\$([\d,]+(?:\.\d+)?)/);
    if (m) return Math.round(Number(m[1].replace(/,/g, "")) * 100);
  }
  const labelMatch = (p.price || "").match(/\$([\d,]+(?:\.\d+)?)/);
  if (labelMatch) {
    const total = Number(labelMatch[1].replace(/,/g, ""));
    if (p.qualifier === "total" && bp && typeof bp.description === "string") {
      const nm = bp.description.match(/(\d+)\s+nights?/);
      const nights = nm ? Number(nm[1]) : 1;
      if (nights > 0) return Math.round((total / nights) * 100);
    }
    return Math.round(total * 100);
  }
  return 0;
}

function normalize(r, nightlyMinCents) {
  const sourceId = String(r.id ?? r.listingId ?? "");
  if (!sourceId) return null;
  const nightlyCents = extractNightlyCents(r);
  if (!nightlyCents || nightlyCents < nightlyMinCents) return null;
  const photos = Array.isArray(r.images)
    ? r.images.map((p) => p.imageUrl ?? p.url ?? "").filter(Boolean) : [];
  const city = typeof r.location === "string" ? r.location : "";
  const subtitle = typeof r.locationSubtitle === "string" ? r.locationSubtitle : "";
  const subParts = subtitle.split(",").map((p) => p.trim()).filter(Boolean);
  const stateName = subParts[1] ?? "";
  const state = STATES[stateName] ?? stateName.slice(0, 2).toUpperCase();
  const host = r.host ?? {};
  const rating = r.rating ?? {};
  const listingType = r.roomType || r.propertyType || null;
  return {
    sourceId,
    city,
    state,
    address: city || subtitle || "",
    nightlyCents,
    photos,
    hostName: host.name || null,
    isSuperhost: !!host.isSuperHost,
    avgRating: typeof rating.guestSatisfaction === "number" ? rating.guestSatisfaction : null,
    reviewCount: typeof rating.reviewsCount === "number" ? rating.reviewsCount : null,
    guestCapacity: typeof r.personCapacity === "number" ? r.personCapacity : null,
    listingType,
    listingUrl: (r.url || "").split("?")[0] || `https://www.airbnb.com/rooms/${sourceId}`,
    title: r.title || r.seoTitle || r.sharingConfigTitle || null,
    description: r.description || r.metaDescription || null,
  };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function mapListingType(raw) {
  const t = (raw ?? "").toLowerCase();
  if (!t) return "entire_home";
  if (t.includes("entire")) return "entire_home";
  if (t.includes("private room")) return "private_room";
  if (t.includes("shared room")) return "shared_room";
  if (t.includes("hotel")) return "hotel_room";
  return "other";
}

async function main() {
  console.log(`[discovery] cities=${CITIES.join(",")} limit=${LIMIT} actor=${ACTOR}`);
  let inserted = 0;
  let scraped = 0;
  for (const city of CITIES) {
    const q = formatCity(city);
    console.log(`\n[apify] scraping ${q}...`);
    try {
      const items = await runActor(ACTOR, {
        locationQueries: [q], currency: "USD", maxListings: LIMIT, adults: 2,
      });
      console.log(`[apify] ${q}: ${items.length} items`);
      scraped += items.length;
      for (const raw of items) {
        const n = normalize(raw, NIGHTLY_MIN_CENTS);
        if (!n) continue;
        const slug = `${slugify(`${n.city} ${n.address}`)}-${n.sourceId.slice(-6)}`;
        try {
          const result = await sql`
            INSERT INTO restay.listings (
              source, source_id, mls_id, address, city, state, zip, price,
              listing_type, photos, agent_name, listing_url, scraped_title,
              scraped_description, review_count, avg_rating, is_superhost,
              guest_capacity, slug
            ) VALUES (
              'airbnb', ${n.sourceId}, ${n.sourceId}, ${n.address}, ${n.city},
              ${n.state}, '', ${n.nightlyCents}, ${mapListingType(n.listingType)},
              ${JSON.stringify(n.photos)}::jsonb, ${n.hostName}, ${n.listingUrl},
              ${n.title}, ${n.description}, ${n.reviewCount}, ${n.avgRating},
              ${n.isSuperhost}, ${n.guestCapacity}, ${slug}
            )
            ON CONFLICT (source, source_id) DO UPDATE SET
              last_seen_at = now(), photos = EXCLUDED.photos, price = EXCLUDED.price
            RETURNING id, (created_at = updated_at) AS is_new
          `;
          if (result[0]?.is_new) inserted++;
        } catch (e) {
          console.error(`[upsert] ${n.sourceId}: ${e.message}`);
        }
      }
    } catch (e) {
      console.error(`[apify] ${q}: ${e.message}`);
    }
  }
  console.log(`\n[discovery] DONE — scraped=${scraped} inserted=${inserted}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
