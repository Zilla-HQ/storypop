import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, listings } from "@/db";
import { and, eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const APIFY = process.env.APIFY_TOKEN?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

async function runApify(actor: string, input: unknown, timeoutSec = 240): Promise<unknown[]> {
  const id = actor.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${id}/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY!)}&timeout=${timeoutSec}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Apify ${actor} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as unknown[];
}

interface NormalizedListing {
  zpid: string;
  url: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number; // cents
  agentName: string | null;
  brokerage: string | null;
  photoCount: number;
  photos: string[];
}

function normalize(raw: Record<string, unknown>, url: string): NormalizedListing | null {
  const zpid = String(raw.zpid ?? "");
  if (!zpid) return null;
  const addr = (typeof raw.address === "object" && raw.address !== null
    ? (raw.address as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const street = String(raw.streetAddress ?? addr.streetAddress ?? "");
  const city = String(raw.city ?? addr.city ?? "");
  const state = String(raw.state ?? addr.state ?? "");
  const zip = String(raw.zipcode ?? addr.zipcode ?? "");
  const priceDollars = Number(raw.price ?? 0);
  const attr = (raw.attributionInfo ?? {}) as Record<string, unknown>;

  // Photos
  type MixedSrc = { url?: string; width?: number };
  type PhotoEntry = { url?: string; mixedSources?: { jpeg?: MixedSrc[] } };
  const photos = (
    Array.isArray(raw.originalPhotos)
      ? (raw.originalPhotos as PhotoEntry[]).map((p) => {
          const sources = p.mixedSources?.jpeg ?? [];
          const sorted = [...sources].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
          return p.url ?? sorted[0]?.url ?? "";
        })
      : []
  ).filter(Boolean);

  return {
    zpid,
    url,
    address: street,
    city,
    state,
    zip,
    price: Math.round(priceDollars * 100),
    agentName: (attr.agentName as string | undefined) ?? null,
    brokerage: (attr.brokerName as string | undefined) ?? null,
    photoCount: photos.length,
    photos,
  };
}

/**
 * Synchronous realtor cold-seed run. Bypasses Inngest cron + step plumbing
 * so the operator can watch the whole chain finish in one HTTP response,
 * see exactly what happened, and iterate on the search-input.
 *
 *   POST /api/admin/seed-realtor?query=<google query>&limit=10
 *
 * What it does (each step reports in the response):
 *   1. Apify Google search for Zillow listing URLs matching the query
 *   2. Apify detail-scrape for each URL (capped by limit)
 *   3. Insert each listing into relist.listings (skip dupes by zpid)
 *   4. Fire listings/ingested for each new row — qualification +
 *      email-discovery + outreach run async on the existing pipeline
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!APIFY) {
    return NextResponse.json({ error: "APIFY_TOKEN not set" }, { status: 500 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "site:zillow.com/homedetails/ Phoenix AZ";
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "10"));

  const trace: Record<string, unknown>[] = [];
  const t0 = Date.now();

  // 1) Google → URLs
  const searchItems = (await runApify("apify/google-search-scraper", {
    queries: query,
    maxPagesPerQuery: 1,
    resultsPerPage: limit,
    countryCode: "us",
    languageCode: "en",
  })) as Array<{ organicResults?: Array<{ url?: string }> }>;
  const urls: string[] = [];
  for (const it of searchItems) {
    for (const r of it.organicResults ?? []) {
      if (r.url && r.url.includes("/homedetails/")) urls.push(r.url);
    }
  }
  const uniqUrls = [...new Set(urls)].slice(0, limit);
  trace.push({ step: "google_search", urls: uniqUrls.length, elapsedMs: Date.now() - t0 });
  if (uniqUrls.length === 0) {
    return NextResponse.json({ ok: true, trace, error: "no urls from google" });
  }

  // 2) Detail-scrape each URL in one Apify run
  const t1 = Date.now();
  const detailItems = await runApify(
    "maxcopell/zillow-detail-scraper",
    { startUrls: uniqUrls.map((u) => ({ url: u })) },
    240,
  );
  trace.push({ step: "detail_scrape", returned: detailItems.length, elapsedMs: Date.now() - t1 });

  // 3) Normalize + insert (skip dupes)
  const t2 = Date.now();
  let inserted = 0;
  let skipped = 0;
  const newListingIds: string[] = [];
  for (let i = 0; i < detailItems.length; i++) {
    const raw = detailItems[i] as Record<string, unknown>;
    const norm = normalize(raw, uniqUrls[i] ?? "");
    if (!norm || !norm.address || !norm.zpid) {
      skipped += 1;
      continue;
    }
    // Skip if we already have this zpid
    const existing = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.source, "zillow"), eq(listings.sourceId, norm.zpid)))
      .limit(1);
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }
    const baseSlug = slugify(`${norm.address} ${norm.zip}`);
    const [row] = await db
      .insert(listings)
      .values({
        source: "zillow",
        sourceId: norm.zpid,
        address: norm.address,
        city: norm.city,
        state: norm.state,
        zip: norm.zip,
        price: norm.price,
        photos: norm.photos,
        agentName: norm.agentName,
        agentEmail: null, // discovered in qualification step
        brokerage: norm.brokerage,
        slug: `${baseSlug}-${norm.zpid.slice(0, 6)}`,
      })
      .returning({ id: listings.id });
    inserted += 1;
    if (row?.id) newListingIds.push(row.id);
  }
  trace.push({ step: "insert", inserted, skipped, elapsedMs: Date.now() - t2 });

  // 4) Fire listings/ingested for each new row to start the qualification +
  //    email-discovery + outreach chain
  const t3 = Date.now();
  for (const id of newListingIds) {
    await inngest.send({
      name: "listings/ingested",
      data: { listingId: id, source: "zillow" },
    });
  }
  trace.push({ step: "fire_ingested", count: newListingIds.length, elapsedMs: Date.now() - t3 });

  return NextResponse.json({
    ok: true,
    query,
    totalElapsedMs: Date.now() - t0,
    inserted,
    skipped,
    fired: newListingIds.length,
    trace,
    sample: newListingIds.slice(0, 3),
  });
}
