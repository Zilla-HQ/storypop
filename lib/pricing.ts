import { fetchAirbnbComps } from "@/lib/apify";

/**
 * Compute a 30-day pricing recommendation for a Restay listing.
 *
 * Approach (v1):
 *   1. Pull ~50 comparable listings within the same city/state with matching
 *      bedroom count + guest capacity via Apify search-actor.
 *   2. Compute median + P25/P75 of nightly rates.
 *   3. Recommend weekday rate at P50, weekend rate at P60.
 *   4. Flag underpriced or overpriced by > 20% vs comp median.
 *
 * Future upgrade: Airbtics API for occupancy-weighted comp pricing if v1
 * accuracy proves insufficient for the $79 deliverable.
 */

export interface PricingRecommendation {
  hostNightlyCents: number;
  compMedianNightlyCents: number;
  compP25NightlyCents: number;
  compP75NightlyCents: number;
  compSampleSize: number;
  recommendedWeekdayCents: number;
  recommendedWeekendCents: number;
  /** Negative = host is underpriced, positive = host is overpriced. */
  deltaVsCompMedianPct: number;
  /** "underpriced" | "overpriced" | "well_priced" */
  verdict: "underpriced" | "overpriced" | "well_priced";
  rationale: string;
}

export async function computePricingRecommendation(args: {
  hostNightlyCents: number;
  city: string;
  state: string;
  bedrooms?: number;
  guestCapacity?: number;
}): Promise<PricingRecommendation | null> {
  const comps = await fetchAirbnbComps({
    city: args.city,
    state: args.state,
    bedrooms: args.bedrooms,
    guestCapacity: args.guestCapacity,
    limit: 60,
  });

  if (comps.length < 8) return null; // not enough signal

  const sorted = [...comps].sort((a, b) => a.nightlyCents - b.nightlyCents);
  const median = pctile(sorted, 0.5);
  const p25 = pctile(sorted, 0.25);
  const p75 = pctile(sorted, 0.75);
  const p60 = pctile(sorted, 0.6);

  const deltaPct = ((args.hostNightlyCents - median) / median) * 100;
  const verdict: PricingRecommendation["verdict"] =
    deltaPct < -20 ? "underpriced" : deltaPct > 20 ? "overpriced" : "well_priced";

  const rationale = buildRationale({
    hostCents: args.hostNightlyCents,
    medianCents: median,
    sampleSize: comps.length,
    verdict,
    deltaPct,
  });

  return {
    hostNightlyCents: args.hostNightlyCents,
    compMedianNightlyCents: median,
    compP25NightlyCents: p25,
    compP75NightlyCents: p75,
    compSampleSize: comps.length,
    recommendedWeekdayCents: median,
    recommendedWeekendCents: p60,
    deltaVsCompMedianPct: Math.round(deltaPct * 10) / 10,
    verdict,
    rationale,
  };
}

function pctile(sortedAsc: { nightlyCents: number }[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[idx].nightlyCents;
}

function buildRationale(args: {
  hostCents: number;
  medianCents: number;
  sampleSize: number;
  verdict: PricingRecommendation["verdict"];
  deltaPct: number;
}): string {
  const host = `$${(args.hostCents / 100).toFixed(0)}`;
  const med = `$${(args.medianCents / 100).toFixed(0)}`;
  switch (args.verdict) {
    case "underpriced":
      return `Across ${args.sampleSize} comparable nearby listings, the median nightly rate is ${med}. You're charging ${host}, ${Math.abs(args.deltaPct).toFixed(0)}% below the median — likely leaving revenue on the table on weekends and high-demand windows.`;
    case "overpriced":
      return `Across ${args.sampleSize} comparable nearby listings, the median nightly rate is ${med}. You're charging ${host}, ${args.deltaPct.toFixed(0)}% above — this often reduces visibility in Airbnb's price filter and slows booking velocity.`;
    case "well_priced":
      return `Across ${args.sampleSize} comparable nearby listings, the median nightly rate is ${med}. Your ${host} sits within the typical band — small weekday/weekend split optimizations are still worth pulling.`;
  }
}
