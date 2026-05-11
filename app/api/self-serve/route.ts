import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { parseListingUrl } from "@/lib/listing-url";
import { slugify } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";
import { getService, DEFAULT_SERVICE_ID } from "@/lib/services";
import { sendMetaEvent } from "@/lib/meta";

export const runtime = "nodejs";

const bodySchema = z.object({
  url: z.string().url().min(10).max(500),
  serviceId: z.string().max(50).optional(),
  eventId: z.string().max(100).optional(),
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
      { error: "Paste a Zillow, Redfin, or Realtor.com listing URL." },
      { status: 400 },
    );
  }

  // Fire Meta Lead event (server-side CAPI). The browser fires the matching
  // pixel event with the same event_id so Meta dedupes. This is the
  // optimization signal for the OUTCOME_LEADS campaign — without it Meta has
  // nothing to optimize on. Fired before the dedup short-circuit so deduped
  // submissions count too (still real intent).
  const fireLead = () =>
    void sendMetaEvent({
      eventName: "Lead",
      eventId: body.eventId,
      fbp: req.cookies.get("_fbp")?.value,
      fbc: req.cookies.get("_fbc")?.value,
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
      sourceUrl: req.headers.get("referer") ?? undefined,
      customData: {
        content_name: "self_serve_submitted",
        source: parsed.source,
      },
    });

  // De-dupe: if we've already scraped this listing, return the existing slug.
  const [existing] = await db
    .select()
    .from(listings)
    .where(eq(listings.sourceId, parsed.sourceId))
    .limit(1);
  if (existing) {
    fireLead();
    return NextResponse.json({ listingId: existing.id, slug: existing.slug, existed: true });
  }

  // Insert a stub — actual data fills in from the Apify scrape.
  const stubAddress = "Loading…";
  const stubSlug = `${slugify(`listing ${parsed.source} ${parsed.sourceId}`)}-${Date.now().toString(36)}`;
  const [row] = await db
    .insert(listings)
    .values({
      source: parsed.source,
      sourceId: parsed.sourceId,
      address: stubAddress,
      city: "",
      state: "",
      zip: "",
      price: 0,
      photos: [],
      slug: stubSlug,
      qualified: true, // self-serve: skip the cold-outreach targeting gate
      qualificationReason: "self-serve opt-in",
    })
    .returning();

  // Resolve the requested service. If unknown, fall back to the default.
  const requested = body.serviceId ? getService(body.serviceId) : undefined;
  const service = requested ?? getService(DEFAULT_SERVICE_ID)!;

  await inngest.send({
    name: "self-serve/submitted",
    data: {
      listingId: row.id,
      url: parsed.canonicalUrl,
      source: parsed.source,
      serviceId: service.id,
    },
  });

  await trackEvent({
    distinctId: row.id,
    event: "self_serve_submitted",
    properties: {
      source: parsed.source,
      source_id: parsed.sourceId,
      service_id: service.id,
    },
  });

  fireLead();
  return NextResponse.json({ listingId: row.id, slug: row.slug, existed: false });
}
