import { env } from "@/lib/env";

/**
 * Homeowner cold-discovery: pull owner-of-record property records that
 * match the service criteria, with the goal of cold-emailing the homeowner
 * a personalized AI mockup ("here's your home with a pool / solar / curb
 * appeal").
 *
 * Data sources (in priority order):
 *   1. ATTOM Data API     (cheap, broad national property data, no UI)
 *   2. PropertyRadar API  (higher quality + richer filters, paid)
 *
 * Both are env-flag-gated. If neither key is set, the cron simply no-ops.
 * The shared output shape lets the rest of the pipeline treat both
 * sources identically.
 */

const ATTOM_KEY = env("ATTOM_API_KEY");
const PROPERTYRADAR_KEY = env("PROPERTYRADAR_API_KEY");

export type HomeownerService = "pool-mockup" | "solar-mockup" | "curb-appeal";

export interface HomeownerProperty {
  /** Stable ID from the upstream provider (e.g. ATTOM property id). */
  sourceId: string;
  source: "attom" | "propertyradar";
  /** Owner of record. */
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerFullName: string | null;
  /** Mailing address may differ from situs (property) address. */
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  lotSizeSqft: number | null;
  livingAreaSqft: number | null;
  yearBuilt: number | null;
  hasPool: boolean | null;
  /** True if the parcel has a structure with a clear south-facing roof
   * section ≥1500 sqft (best-effort from upstream attributes). */
  southFacingRoofSqft: number | null;
  /** Owner-occupied? Skip if not (rentals = wrong audience). */
  ownerOccupied: boolean | null;
}

export interface DiscoveryFilter {
  zip?: string;
  city?: string;
  state?: string;
  service: HomeownerService;
  /** Cap how many candidates we pull per call. */
  limit?: number;
}

/**
 * Public entry point. Picks whichever provider is configured (ATTOM first,
 * PropertyRadar fallback). Returns at most `limit` candidates. Best-effort:
 * exceptions become an empty array; the cron logs the underlying provider
 * call and moves on.
 */
export async function discoverHomeownerProperties(
  filter: DiscoveryFilter,
): Promise<HomeownerProperty[]> {
  if (ATTOM_KEY) {
    try {
      return await pullFromAttom(filter);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[attom] ${(e as Error).message}`);
    }
  }
  if (PROPERTYRADAR_KEY) {
    try {
      return await pullFromPropertyRadar(filter);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[propertyradar] ${(e as Error).message}`);
    }
  }
  return [];
}

// =================== ATTOM ===================
// Docs: https://api.developer.attomdata.com/docs

async function pullFromAttom(filter: DiscoveryFilter): Promise<HomeownerProperty[]> {
  if (!ATTOM_KEY) return [];
  const limit = filter.limit ?? 25;

  // ATTOM's `/property/snapshot` endpoint takes a postalcode + lot/feature
  // filters. We pre-filter by service intent here:
  const snapshotUrl = new URL(
    "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot",
  );
  if (filter.zip) snapshotUrl.searchParams.set("postalcode", filter.zip);
  if (filter.city && filter.state) {
    snapshotUrl.searchParams.set("address1", filter.city);
    snapshotUrl.searchParams.set("address2", `${filter.state}`);
  }
  snapshotUrl.searchParams.set("pagesize", String(limit));

  // Service-specific lot / structure filters
  if (filter.service === "pool-mockup") {
    snapshotUrl.searchParams.set("minlotsize", "10890"); // ¼ acre
    // ATTOM doesn't expose a "no pool" flag in snapshot; we filter post-hoc.
  }
  if (filter.service === "solar-mockup") {
    snapshotUrl.searchParams.set("minuniversalsize", "1500"); // sqft living area as a roof-area proxy
  }

  const res = await fetch(snapshotUrl.toString(), {
    headers: { apikey: ATTOM_KEY!, accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ATTOM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { property?: AttomProperty[] };

  const props = (data.property ?? []).map(normalizeAttom).filter(Boolean) as HomeownerProperty[];

  // Post-hoc service-fit filter (ATTOM snapshot doesn't have all of these).
  return props.filter((p) => matchesService(p, filter.service));
}

interface AttomProperty {
  identifier?: { Id?: string | number; obPropId?: string };
  address?: {
    line1?: string;
    locality?: string;
    countrySubd?: string;
    postal1?: string;
  };
  location?: { latitude?: string | number; longitude?: string | number };
  lot?: { lotsize2?: number; poolType?: string | null };
  building?: { size?: { livingsize?: number }; summary?: { yearBuilt?: number } };
  owner?: { owner1?: { fullname?: string; firstnameandmi?: string; lastname?: string } };
  summary?: { absenteeInd?: string };
}

function normalizeAttom(p: AttomProperty): HomeownerProperty | null {
  const sourceId = String(p.identifier?.Id ?? p.identifier?.obPropId ?? "");
  if (!sourceId) return null;
  const owner = p.owner?.owner1;
  return {
    sourceId,
    source: "attom",
    ownerFirstName: owner?.firstnameandmi ?? null,
    ownerLastName: owner?.lastname ?? null,
    ownerFullName: owner?.fullname ?? null,
    address: p.address?.line1 ?? "",
    city: p.address?.locality ?? "",
    state: p.address?.countrySubd ?? "",
    zip: p.address?.postal1 ?? "",
    lat: p.location?.latitude !== undefined ? Number(p.location.latitude) : null,
    lng: p.location?.longitude !== undefined ? Number(p.location.longitude) : null,
    lotSizeSqft: p.lot?.lotsize2 ?? null,
    livingAreaSqft: p.building?.size?.livingsize ?? null,
    yearBuilt: p.building?.summary?.yearBuilt ?? null,
    hasPool: p.lot?.poolType ? p.lot.poolType !== "NONE" : null,
    southFacingRoofSqft: null, // ATTOM doesn't expose orientation
    ownerOccupied: p.summary?.absenteeInd === "OWNER_OCCUPIED" ? true : p.summary?.absenteeInd ? false : null,
  };
}

// =================== PropertyRadar ===================
// Docs: https://api.propertyradar.com/v1/docs

async function pullFromPropertyRadar(
  filter: DiscoveryFilter,
): Promise<HomeownerProperty[]> {
  if (!PROPERTYRADAR_KEY) return [];
  const limit = filter.limit ?? 25;

  const criteria: Array<Record<string, unknown>> = [];
  if (filter.zip) criteria.push({ name: "ZipFive", value: [filter.zip] });
  if (filter.state) criteria.push({ name: "State", value: [filter.state] });
  // Owner-occupied only — rentals are the wrong audience for "your home with a pool".
  criteria.push({ name: "OwnerOccupied", value: ["1"] });
  if (filter.service === "pool-mockup") {
    criteria.push({ name: "Pool", value: ["0"] }); // no existing pool
    criteria.push({ name: "LotSize", value: [{ from: 10890 }] }); // ≥¼ acre
  }
  if (filter.service === "solar-mockup") {
    criteria.push({ name: "BedSqFt", value: [{ from: 1500 }] });
  }

  const res = await fetch(
    `https://api.propertyradar.com/v1/properties?Limit=${limit}&Purchase=0`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROPERTYRADAR_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Criteria: criteria }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `PropertyRadar ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as { results?: PropertyRadarRow[] };

  return (data.results ?? [])
    .map(normalizePropertyRadar)
    .filter(Boolean) as HomeownerProperty[];
}

interface PropertyRadarRow {
  RadarID?: string;
  Owner?: { FullName?: string; FirstName?: string; LastName?: string };
  SiteAddress?: string;
  SiteCity?: string;
  SiteState?: string;
  SiteZip?: string;
  Latitude?: number;
  Longitude?: number;
  LotSize?: number;
  LivingArea?: number;
  YearBuilt?: number;
  Pool?: number | boolean;
  OwnerOccupied?: number | boolean;
}

function normalizePropertyRadar(r: PropertyRadarRow): HomeownerProperty | null {
  if (!r.RadarID) return null;
  return {
    sourceId: r.RadarID,
    source: "propertyradar",
    ownerFirstName: r.Owner?.FirstName ?? null,
    ownerLastName: r.Owner?.LastName ?? null,
    ownerFullName: r.Owner?.FullName ?? null,
    address: r.SiteAddress ?? "",
    city: r.SiteCity ?? "",
    state: r.SiteState ?? "",
    zip: r.SiteZip ?? "",
    lat: r.Latitude ?? null,
    lng: r.Longitude ?? null,
    lotSizeSqft: r.LotSize ?? null,
    livingAreaSqft: r.LivingArea ?? null,
    yearBuilt: r.YearBuilt ?? null,
    hasPool: r.Pool === undefined ? null : Boolean(r.Pool),
    southFacingRoofSqft: null,
    ownerOccupied:
      r.OwnerOccupied === undefined ? null : Boolean(r.OwnerOccupied),
  };
}

// =================== Service-fit filter ===================

export function matchesService(
  p: HomeownerProperty,
  service: HomeownerService,
): boolean {
  // Owner-occupied gate (rentals = wrong audience). When unknown, allow —
  // the email will still pass CAN-SPAM with the unsubscribe footer.
  if (p.ownerOccupied === false) return false;

  if (service === "pool-mockup") {
    if (p.hasPool === true) return false;
    if (p.lotSizeSqft !== null && p.lotSizeSqft < 7000) return false;
  }
  if (service === "solar-mockup") {
    if (p.livingAreaSqft !== null && p.livingAreaSqft < 1200) return false;
  }
  if (service === "curb-appeal") {
    // Hard to pre-qualify from records alone; let everything through.
  }
  return true;
}
