import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { geocodeAddress } from "@/lib/mapbox";
import { servicesForAudience, getService } from "@/lib/services";
import { slugify } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";

export const runtime = "nodejs";

const bodySchema = z.object({
  address: z.string().min(5).max(300),
  serviceId: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Restrict to renovate-audience services so this endpoint can't be used
  // for paid agent flows.
  const renovateServices = servicesForAudience("renovate");
  const service = renovateServices.find((s) => s.id === body.serviceId);
  if (!service) {
    return NextResponse.json(
      { error: "Service not available for homeowners" },
      { status: 400 },
    );
  }

  const geo = await geocodeAddress(body.address);
  if (!geo) {
    return NextResponse.json(
      { error: "Couldn't find that address. Try the full street + city + state + zip." },
      { status: 400 },
    );
  }

  // Stable source_id from the geocoded address — same address won't double-create.
  const sourceId = `homeowner-${slugify(geo.full_address)}`;

  const [existing] = await db
    .select()
    .from(listings)
    .where(eq(listings.sourceId, sourceId))
    .limit(1);
  if (existing) {
    // Re-fire the chosen service so a fresh preview generates if the user
    // picked a different service this time.
    await inngest.send({
      name: "listings/qualified",
      data: { listingId: existing.id, serviceId: service.id },
    });
    return NextResponse.json({
      listingId: existing.id,
      slug: existing.slug,
      existed: true,
    });
  }

  // Parse parts from geocoded full address: "123 Main St, Phoenix, Arizona 85001, United States"
  const parts = geo.full_address.split(",").map((p) => p.trim());
  const line1 = parts[0] ?? body.address;
  const city = parts[1] ?? "";
  const stateZip = parts[2] ?? "";
  const stateMatch = stateZip.match(/^([A-Za-z ]+)\s+(\d{5})/);
  const state = stateMatch ? stateMatch[1].trim().slice(0, 2).toUpperCase() : "";
  const zip = geo.zip ?? stateMatch?.[2] ?? "";

  const slug = `${slugify(`${line1} ${zip}`)}-${Math.random().toString(36).slice(2, 8)}`;

  const [row] = await db
    .insert(listings)
    .values({
      source: "zillow", // schema requires a source enum value; "zillow" is fine as a placeholder
      sourceId,
      address: line1,
      city,
      state,
      zip,
      price: 0,
      photos: [],
      slug,
      qualified: true,
      qualificationReason: `homeowner:${service.id}`,
    })
    .returning();

  await inngest.send({
    name: "listings/qualified",
    data: { listingId: row.id, serviceId: service.id },
  });

  await trackEvent({
    distinctId: row.id,
    event: "homeowner_address_submitted",
    properties: { service_id: service.id, full_address: geo.full_address },
  });

  return NextResponse.json({ listingId: row.id, slug: row.slug, existed: false });
}
