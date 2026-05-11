"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { getService } from "@/lib/services";
import { slugify } from "@/lib/utils";
import { geocodeAddress } from "@/lib/mapbox";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
const ADMIN_DOMAINS = (process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHORIZED");
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  const domain = email?.split("@")[1];
  const allowed =
    email === ADMIN_EMAIL || (domain ? ADMIN_DOMAINS.includes(domain) : false);
  if (!allowed) throw new Error("FORBIDDEN");
}

export async function runCampaign(args: {
  serviceId: string;
  addresses: string[];
}): Promise<{ queued: number; invalid: number; duplicates: number }> {
  await requireAdmin();
  const service = getService(args.serviceId);
  if (!service) throw new Error("Unknown service");

  let queued = 0;
  let invalid = 0;
  let duplicates = 0;

  for (const raw of args.addresses) {
    const geo = await geocodeAddress(raw);
    if (!geo) {
      invalid++;
      continue;
    }
    // Build a stable source_id from the geocoded address so re-running the
    // campaign doesn't duplicate listings.
    const sourceId = `campaign-${slugify(geo.full_address)}`;

    const [existing] = await db
      .select()
      .from(listings)
      .where(eq(listings.sourceId, sourceId))
      .limit(1);
    if (existing) {
      duplicates++;
      // Re-fire the qualified event with this service so we generate a fresh
      // mockup for the existing listing too.
      await inngest.send({
        name: "listings/qualified",
        data: { listingId: existing.id, serviceId: service.id },
      });
      continue;
    }

    // Parse address parts roughly from the geocoded full_address
    // ("123 Main St, Phoenix, Arizona 85001, United States")
    const parts = geo.full_address.split(",").map((p) => p.trim());
    const line1 = parts[0] ?? raw;
    const city = parts[1] ?? "";
    const stateZip = parts[2] ?? "";
    const stateMatch = stateZip.match(/^([A-Za-z ]+)\s+(\d{5})/);
    const state = stateMatch ? stateMatch[1].slice(0, 2).toUpperCase() : "";
    const zip = geo.zip ?? stateMatch?.[2] ?? "";

    const slug = `${slugify(`${line1} ${zip}`)}-${Math.random().toString(36).slice(2, 8)}`;

    const [row] = await db
      .insert(listings)
      .values({
        source: "zillow",
        sourceId,
        address: line1,
        city,
        state,
        zip,
        price: 0,
        photos: [], // satellite-tile services don't need MLS photos
        slug,
        qualified: true,
        qualificationReason: `campaign:${service.id}`,
      })
      .returning();

    await inngest.send({
      name: "listings/qualified",
      data: { listingId: row.id, serviceId: service.id },
    });

    queued++;
  }

  return { queued, invalid, duplicates };
}
