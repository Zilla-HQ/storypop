import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseListingUrl } from "@/lib/listing-url";
import { fetchAirbnbListingDirect } from "@/lib/airbnb-direct";
import { gradeListing, graderInputFromScrape } from "@/lib/grader";
import { sendCapiEvent, userDataFromRequest } from "@/lib/meta-capi";
import { trackEvent } from "@/lib/posthog";
import { readAttribution } from "@/lib/attribution";

export const runtime = "nodejs";
export const maxDuration = 30; // grader is ~3-5s; cap at 30 for tail latency.

const bodySchema = z.object({
  url: z.string().url().min(10).max(500),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const parsed = parseListingUrl(body.url);
  if (!parsed) {
    return NextResponse.json(
      { error: "Paste an Airbnb listing URL (e.g. airbnb.com/rooms/12345)." },
      { status: 400 },
    );
  }

  const scrape = await fetchAirbnbListingDirect(parsed.canonicalUrl);
  if (!scrape) {
    return NextResponse.json(
      { error: "We couldn't load that listing — Airbnb may have rate-limited the page. Try again in a minute." },
      { status: 502 },
    );
  }

  const grade = await gradeListing(graderInputFromScrape(scrape));

  // CAPI Lead — same conversion event the self-serve flow fires; the grader
  // is functionally a higher-engagement Lead and should feed the same
  // optimization target.
  const eventId = `grade-${parsed.sourceId}-${Date.now()}`;
  void sendCapiEvent({
    eventName: "Lead",
    eventId,
    sourceUrl: req.headers.get("referer") ?? undefined,
    user: { ...userDataFromRequest(req), externalId: parsed.sourceId },
    custom: {
      contentName: `Restay grader — ${parsed.source}`,
      contentIds: [parsed.sourceId],
      contentType: "listing",
    },
  });

  const attr = await readAttribution();
  void trackEvent({
    distinctId: parsed.sourceId,
    event: "grader_run",
    properties: {
      source_id: parsed.sourceId,
      score: grade.overall,
      letter: grade.letter,
      utm_source: attr.utm_source ?? null,
      utm_medium: attr.utm_medium ?? null,
      utm_campaign: attr.utm_campaign ?? null,
    },
  });

  return NextResponse.json({
    sourceId: parsed.sourceId,
    canonicalUrl: parsed.canonicalUrl,
    listing: {
      title: scrape.scrapedTitle,
      city: scrape.city,
      state: scrape.state,
      photoCount: scrape.photos.length,
      thumbnail: scrape.photos[0] ?? null,
      reviewCount: scrape.reviewCount,
      avgRating: scrape.avgRating,
      isSuperhost: scrape.isSuperhost,
    },
    grade,
    eventId,
  });
}
