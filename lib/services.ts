import type { RoomKind } from "@/lib/room-classify";

/**
 * A "service" is one transform we can offer on a property's photos
 * (or a derived asset like a satellite tile). Adding a service is just
 * adding an entry here — the preview pipeline reads `promptTemplate`
 * and `imageSource` to know what to do.
 */

export type ImageSource =
  | "listing_photo" // pick best matching photo from MLS
  | "satellite_tile" // pull a Mapbox satellite tile by lat/lng
  | "exterior_facade"; // pick the exterior_front photo

// Audience is the union of the template's two generic placeholders
// (audience-a / audience-b — kept so the stubbed FAQ + services-grid in
// components/marketing/* still typecheck for new merchants) and the
// vertical-specific audiences mirrored from the Relist reference build
// (agents / renovate).
export type Audience =
  | "audience-a"
  | "audience-b"
  | "agents"
  | "renovate"
  | "both";

export interface ServiceDefinition {
  id: string; // slug — also the value stored in DB
  name: string;
  shortDescription: string; // for cards
  longDescription: string; // for service-detail pages
  basePriceCents: number;
  rushPriceCents: number;
  category: "interior" | "exterior" | "marketing";
  /** Which funnel(s) this service appears in. */
  audience: Audience;
  imageSource: ImageSource;
  // For listing_photo source: which room types this service applies to.
  applicableRooms?: RoomKind[];
  // The actual fal.ai edit prompt (we append the source-aware preamble).
  promptTemplate: string;
  // CTA copy for the landing page button + email subject template
  ctaPrimary: string;
  emailSubjectTemplate: string; // {{shortAddress}} replaced
  // Visual category icon (lucide-react name)
  icon: "Sofa" | "Trees" | "SunMedium" | "Sparkles" | "Building2" | "Waves";
}

export const SERVICES: ServiceDefinition[] = [
  // ─── Photo enhancement (we charge for the deliverable) ──────────────────
  // Pricing anchor: traditional virtual staging is $25-50/photo with 24-48h
  // turnaround. Our $89 for 12-15 photos in <2h is ~80% cheaper, fast delivery
  // is the differentiator, so we don't have to underprice further.
  {
    id: "photo-staging",
    name: "Photo Staging",
    shortDescription:
      "Empty or dated rooms restaged with modern furniture and decor.",
    longDescription:
      "Pull every interior photo, virtually stage each room with photo-realistic furniture and decor matched to your style preset, return the full set in under 2 hours. NAR-compliant disclosure stamped on every photo.",
    basePriceCents: 8900,
    rushPriceCents: 14900,
    category: "interior",
    audience: "agents", // staging is listing prep — not relevant on the homeowner side
    imageSource: "listing_photo",
    applicableRooms: ["kitchen", "living_room", "dining_room", "bedroom", "office"],
    promptTemplate:
      "Add photo-realistic furniture and decor: {{styleFragment}}. STRICT: keep the exact same camera angle, walls, ceiling, floor, windows, doors, and architectural features identical to the source. Match the existing lighting and shadows. Do not change the room type, layout, or perspective.",
    ctaPrimary: "Stage all my listing photos",
    emailSubjectTemplate: "Your listing at {{shortAddress}} — staged photos inside",
    icon: "Sofa",
  },
  {
    id: "twilight-exterior",
    name: "Twilight Exterior",
    shortDescription:
      "Daytime exterior shots transformed into golden-hour and twilight magic.",
    longDescription:
      "Sky replacement, warm lighting, glow-from-within window pass. Turn a flat midday MLS shot into the cinematic exterior that drives showings.",
    basePriceCents: 4900,
    rushPriceCents: 7900,
    category: "exterior",
    audience: "agents",
    imageSource: "exterior_facade",
    promptTemplate:
      "Transform this exterior into a cinematic twilight scene. Replace the sky with a soft sunset gradient (warm pink and orange transitioning to deep blue). Add warm interior light glowing from the windows. Soft golden-hour highlights on the facade. STRICT: keep the building's geometry, materials, landscaping, and camera angle identical.",
    ctaPrimary: "Twilight my exterior",
    emailSubjectTemplate: "Your listing at {{shortAddress}} — twilight makeover inside",
    icon: "SunMedium",
  },

  // ─── Renovation services (free preview, monetize via contractor referral) ─
  // Model: free mockup → contractor referral fee. Realtor-side referrals to
  // pool/solar/landscape contractors typically pay 8-15% of the project value.
  // For the average pool ($75k) at 12% = $9,000 per closed lead. We don't
  // charge the homeowner; we charge the contractor.
  {
    id: "curb-appeal",
    name: "Curb Appeal",
    shortDescription:
      "Manicured landscaping, fresh paint, and updated walkways — without lifting a shovel.",
    longDescription:
      "Render a redesigned front yard: new sod, planted beds, trim paint refresh, lighting fixtures. See your home's potential, then we connect you to vetted local landscapers who can bring the mockup to life. The mockup is free; you only pay your contractor for the work itself.",
    basePriceCents: 0,
    rushPriceCents: 0,
    category: "exterior",
    audience: "renovate",
    // Satellite-tile so homeowners submitting just an address (no MLS
    // photos) can also get a curb-appeal mockup. Top-down view shows the
    // front yard / driveway clearly enough to render landscaping
    // refreshes; agents who want a true street-level facade can submit
    // a Zillow URL on /agents instead, which gives the preview agent
    // exterior MLS photos to work from.
    imageSource: "satellite_tile",
    promptTemplate:
      "Edit this exact top-down satellite photograph to refresh the curb appeal of the home. Add a manicured emerald-green front lawn, tasteful planted beds along the front walkway with low evergreen shrubs and seasonal flowers, fresh dark mulch around any trees, a clean concrete driveway, and crisp white-edged borders around the lawn. STRICT: keep the house roof, structure, driveway shape, neighboring lots, and the top-down camera angle identical to the source. Photo-realistic satellite imagery look (sharp top-down perspective, midday lighting, no oblique tilt). No text, no watermarks.",
    ctaPrimary: "Get my curb-appeal mockup",
    emailSubjectTemplate: "Your front yard at {{shortAddress}} — refreshed",
    icon: "Trees",
  },
  {
    id: "pool-mockup",
    name: "Pool Mockup",
    shortDescription:
      "See an in-ground pool in your actual backyard. Connect with vetted builders if you love it.",
    longDescription:
      "We pull a satellite tile of your property's lot, render a luxury in-ground pool with surrounding patio in your real backyard, and calculate the typical build cost + estimated home-value lift for your zip code. Free mockup. If you decide to move forward, we connect you with vetted local pool builders who pay us a referral fee — your quote is the same as if you went direct.",
    basePriceCents: 0,
    rushPriceCents: 0,
    category: "exterior",
    audience: "renovate",
    imageSource: "satellite_tile",
    promptTemplate:
      "Render an in-ground rectangular swimming pool into the empty area of this satellite-view backyard. Surround the pool with light grey concrete or natural stone patio. Add tasteful landscaping along the edges. STRICT: keep the existing house, lot boundaries, neighbors, and camera angle (overhead satellite view) identical. The pool should fit naturally in the largest open backyard area.",
    ctaPrimary: "See my pool mockup",
    emailSubjectTemplate: "Your backyard at {{shortAddress}} — with a pool",
    icon: "Waves",
  },
  {
    id: "solar-mockup",
    name: "Solar Mockup",
    shortDescription:
      "Visualize solar panels on your roof with a 25-year savings estimate.",
    longDescription:
      "Render a tasteful solar array on your roof using a satellite view, calculate the estimated lifetime savings against your zip's average utility rate, and connect with vetted local solar installers. The mockup and savings calc are free; if you choose an installer through us, they pay our referral fee — your install price is unchanged.",
    basePriceCents: 0,
    rushPriceCents: 0,
    category: "exterior",
    audience: "renovate",
    imageSource: "satellite_tile",
    promptTemplate:
      "Render a tasteful black-framed solar panel array on the south-facing roof sections of this home in the satellite view. Realistic spacing and orientation. STRICT: keep the existing house, lot, neighbors, and camera angle identical.",
    ctaPrimary: "See my solar mockup",
    emailSubjectTemplate: "Your roof at {{shortAddress}} — with solar",
    icon: "SunMedium",
  },
];

export const DEFAULT_SERVICE_ID = "photo-staging";

export function getService(id: string): ServiceDefinition | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function requireService(id: string): ServiceDefinition {
  const s = getService(id);
  if (!s) throw new Error(`Unknown service id: ${id}`);
  return s;
}

export function listServices(category?: ServiceDefinition["category"]): ServiceDefinition[] {
  return category ? SERVICES.filter((s) => s.category === category) : SERVICES;
}

/** Services visible to a given audience funnel. "both" services appear in everyone's view. */
export function servicesForAudience(audience: Audience): ServiceDefinition[] {
  if (audience === "both") return SERVICES;
  return SERVICES.filter((s) => s.audience === audience || s.audience === "both");
}

/**
 * Pick the best service for a given listing based on its photos.
 * Used by the outreach agent to decide what hook to lead the email with.
 *
 * Heuristics for v1:
 * - If most rooms are empty / dated → photo-staging
 * - If exterior_front exists and is shot in harsh daytime → twilight-exterior
 * - If lot has empty backyard (we don't detect this without satellite yet) → pool-mockup
 *
 * Default = photo-staging.
 */
export function pickPrimaryService(
  classifications: { kind: RoomKind; empty: boolean; stagingValue: number }[],
): ServiceDefinition {
  const exterior = classifications.find(
    (c) => c.kind === "exterior_front" || c.kind === "exterior_back",
  );
  const interiorEmptyCount = classifications.filter(
    (c) => c.empty && c.kind !== "exterior_front" && c.kind !== "exterior_back",
  ).length;

  if (interiorEmptyCount >= 2) return requireService("photo-staging");
  if (exterior && exterior.stagingValue >= 3) return requireService("twilight-exterior");
  return requireService(DEFAULT_SERVICE_ID);
}
