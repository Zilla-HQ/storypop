/**
 * Heuristic score of the listing's *agent* value as a target for cold outreach.
 * Higher = worth emailing (active agent, meaningful price, non-team).
 * 1-5 scale. No external lookups — uses only a minimal input shape so it works
 * against both live DB rows and Inngest-serialized step returns (where Dates
 * are strings).
 */
export interface AgentScoringInput {
  agentEmail?: string | null;
  price: number;
  dom?: number | null;
  brokerage?: string | null;
}

export function scoreAgentValue(listing: AgentScoringInput): { score: number; reason: string } {
  let score = 3;
  const reasons: string[] = [];

  if (!listing.agentEmail) {
    return { score: 1, reason: "No agent email on record" };
  }

  // Price tier
  if (listing.price >= 75_000_000) {
    score += 1;
    reasons.push("luxury price");
  } else if (listing.price < 30_000_000) {
    score -= 1;
    reasons.push("low price");
  }

  // Days on market — fresh listings are better targets
  if (typeof listing.dom === "number") {
    if (listing.dom <= 7) {
      score += 0.5;
      reasons.push("fresh listing");
    } else if (listing.dom > 60) {
      score -= 0.5;
      reasons.push("stale listing");
    }
  }

  // Penalize team-ish brokerages (harder to reach decision-maker)
  const brokerage = (listing.brokerage ?? "").toLowerCase();
  if (brokerage.includes("team") || brokerage.includes("group")) {
    score -= 0.5;
    reasons.push("team brokerage");
  }

  return {
    score: Math.max(1, Math.min(5, Number(score.toFixed(2)))),
    reason: reasons.join(", ") || "default",
  };
}

export function computeTargetScore(args: {
  photoScore: number;
  agentValueScore: number;
  priceCents: number;
}): number {
  // Target is inversely correlated with photo quality (bad photos = good target)
  // and positively correlated with agent value.
  const photoComponent = 5 - args.photoScore; // 0-4 range
  const weighted = photoComponent * 0.6 + args.agentValueScore * 0.4;
  return Number(weighted.toFixed(2));
}

// Scoring is OFF — every discovered listing qualifies. The data showed
// >90% of Zillow MLS photos score 4.5-5.0 (Claude vision rates pro photos
// uniformly high), so any photo-quality filter became an aggressive
// rejection of basically everything. Volume now > precision; outreach.ts
// still requires an agent_email before sending, so no-email listings drop
// out naturally and only listings with a real recipient get cold-emailed.
//
// The photo + agent scores are still computed and stored on the row for
// observability (you can sort /admin/listings by them), but isQualified
// no longer gates on them.
export const QUALIFICATION_THRESHOLDS = {
  maxPhotoScore: Infinity,
  minAgentValueScore: 0,
  minPriceCents: 0,
} as const;

export function isQualified(_args: {
  photoScore: number;
  agentValueScore: number;
  priceCents: number;
}): { qualified: boolean; reason: string } {
  return { qualified: true, reason: "all-qualified (scoring off)" };
}
