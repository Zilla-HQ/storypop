import { env } from "@/lib/env";

const apiKey = env("YELP_API_KEY");

export interface YelpBusiness {
  id: string;
  name: string;
  url: string;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  address: string | null;
}

/**
 * Search Yelp Fusion for businesses near a given location matching a category
 * slug (Yelp's own taxonomy). Returns a clean small shape, not the full payload.
 */
export async function searchBusinesses(args: {
  category: string;
  /** Either "City, ST" or a 5-digit zip. */
  location: string;
  limit?: number;
}): Promise<YelpBusiness[]> {
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn("[yelp] YELP_API_KEY not set — returning empty results");
    return [];
  }

  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("categories", args.category);
  url.searchParams.set("location", args.location);
  url.searchParams.set("limit", String(args.limit ?? 10));
  url.searchParams.set("sort_by", "rating");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Yelp ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    businesses?: Array<{
      id: string;
      name: string;
      url: string;
      phone?: string;
      rating?: number;
      review_count?: number;
      location?: { display_address?: string[] };
    }>;
  };
  return (data.businesses ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    url: b.url,
    phone: b.phone || null,
    rating: typeof b.rating === "number" ? b.rating : null,
    review_count: typeof b.review_count === "number" ? b.review_count : null,
    address: b.location?.display_address?.join(", ") ?? null,
  }));
}

/**
 * Pick the top N contractors that pass our quality bar (4+ stars, 20+ reviews).
 * Falls back to relaxed criteria if not enough qualified results.
 */
export async function findTopContractors(args: {
  category: string;
  location: string;
  count: number;
}): Promise<YelpBusiness[]> {
  const all = await searchBusinesses({ ...args, limit: 20 });
  const qualified = all.filter(
    (b) => (b.rating ?? 0) >= 4 && (b.review_count ?? 0) >= 20,
  );
  if (qualified.length >= args.count) return qualified.slice(0, args.count);
  // Relaxed bar — 3.5+ stars, 5+ reviews
  const relaxed = all.filter(
    (b) => (b.rating ?? 0) >= 3.5 && (b.review_count ?? 0) >= 5,
  );
  return relaxed.slice(0, args.count);
}

/**
 * Map Realscale services to Yelp category slugs. Multiple categories
 * comma-separated (Yelp accepts that).
 */
export const SERVICE_CATEGORY: Record<string, string> = {
  "pool-mockup": "swimmingpools,pool_cleaners",
  "solar-mockup": "solarinstallation",
  "curb-appeal": "landscaping,gardeners",
};
