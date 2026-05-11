/**
 * Free public listing-grader. Powers /grade — paste an Airbnb URL, get a
 * 0–100 score across copy / photos / signals plus 3 named fixes. Backed
 * by lib/airbnb-direct.ts (no Apify cost) + lib/claude.ts (text) + lib/vision.ts.
 *
 * Designed to run in <5s and cost <$0.01 per call so it can be opened up
 * publicly without rate limits killing margin. Pricing-comp scoring is NOT
 * included here — that's the paid Tune-Up upgrade.
 */

import { callClaude } from "@/lib/claude";
import { scoreListingPhotos } from "@/lib/vision";
import type { ScrapedListing } from "@/lib/apify";

export interface GraderInput {
  scrapedTitle?: string;
  scrapedDescription?: string;
  photos: string[];
  reviewCount?: number;
  avgRating?: number;
  isSuperhost?: boolean;
  city?: string;
}

export interface GraderResult {
  /** 0–100 overall grade. */
  overall: number;
  /** Letter grade derived from overall. */
  letter: "A" | "B" | "C" | "D" | "F";
  copy: {
    score: number; // 0-100
    issues: string[];
  };
  photos: {
    score: number; // 0-100
    issues: string[];
    sampledCount: number;
  };
  signals: {
    score: number; // 0-100
    issues: string[];
  };
  /** Top 3 prioritized fixes — what we'd attack first in a Tune-Up. */
  topFixes: string[];
}

const COPY_PROMPT = `You are grading an Airbnb listing's title + description for booking conversion.

Score 0–100. Penalize:
- Generic title ("Cozy 2BR in Austin"): -15
- Title doesn't lead with strongest amenity / experience: -10
- Description under 80 words: -15
- Description lacks specifics (no concrete amenities, layout, walkability): -10
- All-caps / emoji-spam title: -5
- No hook in opening line: -5

Reward (additive up to 100):
- Specific differentiator in title: +5
- Description structured as Hook / Proof / Call: +5

Return ONLY JSON, no markdown fences:
{"score": <0-100>, "issues": ["short specific issue", ...]}

Keep issues to max 4 entries, each under 80 chars.`;

const FIXES_PROMPT = `You are an Airbnb listing-optimization expert. Given a listing's grade breakdown,
write the 3 highest-impact fixes — concrete, specific, no fluff. Each fix should be one sentence
under 110 chars, action-oriented ("Rewrite title to lead with X..."), and target the lowest-scoring areas.

Return ONLY JSON:
{"fixes": ["fix 1", "fix 2", "fix 3"]}`;

export async function gradeListing(input: GraderInput): Promise<GraderResult> {
  const [copy, photos] = await Promise.all([
    gradeCopy(input),
    gradePhotos(input.photos),
  ]);
  const signals = gradeSignals(input);

  // Weighted composite — photos are the biggest visual driver of conversion
  // for Airbnb so they get the highest weight. Copy is what shows on the
  // search-result tile (title) so it gets second.
  const overall = Math.round(
    photos.score * 0.45 + copy.score * 0.35 + signals.score * 0.2,
  );

  const topFixes = await pickTopFixes({ copy, photos, signals, input });

  return {
    overall,
    letter: letterFor(overall),
    copy,
    photos,
    signals,
    topFixes,
  };
}

async function gradeCopy(
  input: GraderInput,
): Promise<{ score: number; issues: string[] }> {
  if (!input.scrapedTitle && !input.scrapedDescription) {
    return { score: 50, issues: ["Couldn't read your title or description from the listing."] };
  }

  const user = `Title: ${input.scrapedTitle ?? "(missing)"}

Description:
${input.scrapedDescription ?? "(missing)"}`;

  const raw = await callClaude({ system: COPY_PROMPT, user, maxTokens: 600 });
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as { score?: number; issues?: string[] };
    const score = clamp(parsed.score ?? 60, 0, 100);
    const issues = Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : [];
    return { score, issues };
  } catch {
    return { score: 60, issues: [] };
  }
}

async function gradePhotos(
  photos: string[],
): Promise<{ score: number; issues: string[]; sampledCount: number }> {
  if (photos.length === 0) {
    return {
      score: 30,
      issues: ["We couldn't load any photos for this listing."],
      sampledCount: 0,
    };
  }

  // Score 3 photos via Claude vision (1-5 scale per photo).
  const { avgScore, perPhoto } = await scoreListingPhotos(photos);
  // Convert 1-5 → 0-100. 5 → 100, 1 → 0.
  const baseScore = clamp(((avgScore - 1) / 4) * 100, 0, 100);

  // Photo-count penalty: under 10 photos hurts conversion noticeably.
  const countPenalty = photos.length < 10 ? 15 : photos.length < 20 ? 5 : 0;
  const score = Math.round(clamp(baseScore - countPenalty, 0, 100));

  const issues: string[] = [];
  if (photos.length < 10) {
    issues.push(`Only ${photos.length} photos uploaded — Airbnb's algorithm rewards 20+.`);
  }
  // Pull the worst-rated photo's reason as a representative issue.
  const worst = perPhoto.reduce((acc, p) => (p.score < acc.score ? p : acc), perPhoto[0]);
  if (worst && worst.score <= 3) {
    issues.push(`Sample photo: ${worst.reason}`);
  }
  if (avgScore < 3.5) {
    issues.push("Lighting and color grading look phone-shot — restyling lifts conversion materially.");
  }

  return { score, issues, sampledCount: perPhoto.length };
}

function gradeSignals(input: GraderInput): { score: number; issues: string[] } {
  let score = 70; // baseline
  const issues: string[] = [];

  // Title length — Airbnb truncates at ~50 chars on search results.
  const titleLen = (input.scrapedTitle ?? "").length;
  if (titleLen > 60) {
    score -= 8;
    issues.push(`Title is ${titleLen} chars — Airbnb truncates at ~50 on search results.`);
  } else if (titleLen < 15 && titleLen > 0) {
    score -= 5;
    issues.push("Title is unusually short — leaves keyword real estate on the table.");
  }

  // Description length.
  const descLen = (input.scrapedDescription ?? "").length;
  if (descLen < 200) {
    score -= 12;
    issues.push("Description is too short — under ~150 words hurts ranking and trust.");
  }

  // Review count — interpreted alongside rating.
  if (typeof input.reviewCount === "number") {
    if (input.reviewCount === 0) {
      score -= 5;
      issues.push("Zero reviews — first 3 reviews are your hardest, lean on family/friends if possible.");
    } else if (input.reviewCount >= 100 && (input.avgRating ?? 5) < 4.7) {
      score -= 10;
      issues.push(`Established listing (${input.reviewCount} reviews) but rating below 4.7 — stop the rot first.`);
    }
  }

  // Rating — sub-4.7 means improvements have a path.
  if (typeof input.avgRating === "number") {
    if (input.avgRating < 4.5) {
      score -= 10;
      issues.push(`Rating ${input.avgRating.toFixed(2)} — review-keyword analysis usually surfaces 2–3 fixable issues.`);
    } else if (input.avgRating >= 4.9) {
      score += 5;
    }
  }

  // Superhost bonus.
  if (input.isSuperhost) {
    score += 4;
  }

  return { score: clamp(Math.round(score), 0, 100), issues: issues.slice(0, 3) };
}

async function pickTopFixes(args: {
  copy: { score: number; issues: string[] };
  photos: { score: number; issues: string[] };
  signals: { score: number; issues: string[] };
  input: GraderInput;
}): Promise<string[]> {
  const summary = `Copy score: ${args.copy.score}/100. Issues: ${args.copy.issues.join("; ") || "(none)"}
Photos score: ${args.photos.score}/100. Issues: ${args.photos.issues.join("; ") || "(none)"}
Signals score: ${args.signals.score}/100. Issues: ${args.signals.issues.join("; ") || "(none)"}

Title: ${args.input.scrapedTitle ?? "(missing)"}
Description excerpt: ${(args.input.scrapedDescription ?? "").slice(0, 400)}
Photo count: ${args.input.photos.length}
${typeof args.input.reviewCount === "number" ? `Reviews: ${args.input.reviewCount}` : ""}
${typeof args.input.avgRating === "number" ? `Avg rating: ${args.input.avgRating}` : ""}`;

  const raw = await callClaude({ system: FIXES_PROMPT, user: summary, maxTokens: 400 });
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as { fixes?: string[] };
    const fixes = Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 3) : [];
    if (fixes.length === 3) return fixes;
  } catch {
    /* fall through to fallback */
  }

  // Heuristic fallback — pull from the worst-scoring section's issues.
  const ranked = [
    { name: "copy", section: args.copy },
    { name: "photos", section: args.photos },
    { name: "signals", section: args.signals },
  ].sort((a, b) => a.section.score - b.section.score);

  const fixes: string[] = [];
  for (const r of ranked) {
    for (const issue of r.section.issues) {
      if (fixes.length < 3) fixes.push(issue);
    }
  }
  while (fixes.length < 3) fixes.push("Refresh the listing — most haven't been touched in over a year.");
  return fixes.slice(0, 3);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function letterFor(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Convenience helper: build a GraderInput from a ScrapedListing returned by
 * lib/airbnb-direct.ts. Used by /api/grade.
 */
export function graderInputFromScrape(s: ScrapedListing): GraderInput {
  return {
    scrapedTitle: s.scrapedTitle,
    scrapedDescription: s.scrapedDescription,
    photos: s.photos,
    reviewCount: s.reviewCount ?? undefined,
    avgRating: s.avgRating ?? undefined,
    isSuperhost: s.isSuperhost ?? undefined,
    city: s.city,
  };
}
