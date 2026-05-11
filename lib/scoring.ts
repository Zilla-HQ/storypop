/**
 * "Scoring" in StoryPop's model isn't about ranking cold-outreach targets
 * (we don't do cold outreach). It's about gating book-request quality so
 * we don't burn fal.ai budget on garbage inputs.
 *
 * 1-5 scale. Higher = the form is well-filled-out and the (optional)
 * uploaded photo is usable for character-lock.
 */
export interface BookScoringInput {
  childName?: string | null;
  childAge?: number | null;
  pronouns?: string | null;
  archetype?: string | null;
  photoUrl?: string | null;
  /** 0-1. Set by lib/vision.ts when a photo is uploaded. */
  photoClarityScore?: number | null;
}

export function scoreBookRequest(input: BookScoringInput): {
  score: number;
  reason: string;
  completeness: number;
} {
  let score = 3;
  const reasons: string[] = [];

  const hasName = Boolean(input.childName && input.childName.trim().length > 0);
  const hasAge = typeof input.childAge === "number" && input.childAge >= 1 && input.childAge <= 12;
  const hasArchetype = Boolean(input.archetype && input.archetype.trim().length > 0);
  const hasPronouns = Boolean(input.pronouns);
  const hasPhoto = Boolean(input.photoUrl);

  const requiredFields = [hasName, hasAge, hasArchetype];
  const optionalFields = [hasPronouns, hasPhoto];
  const completeness =
    (requiredFields.filter(Boolean).length / requiredFields.length) * 0.8 +
    (optionalFields.filter(Boolean).length / optionalFields.length) * 0.2;

  if (!hasName) reasons.push("missing name");
  if (!hasAge) reasons.push("missing/invalid age");
  if (!hasArchetype) reasons.push("missing archetype");

  if (!hasName || !hasAge || !hasArchetype) {
    return { score: 1, reason: reasons.join(", "), completeness };
  }

  if (hasPronouns) {
    score += 0.25;
  }

  if (hasPhoto) {
    score += 0.5;
    if (typeof input.photoClarityScore === "number") {
      if (input.photoClarityScore < 0.3) {
        score -= 1;
        reasons.push("photo too blurry / no face detected");
      } else if (input.photoClarityScore >= 0.7) {
        score += 0.5;
        reasons.push("clear photo");
      }
    }
  } else {
    reasons.push("no photo — using default character");
  }

  return {
    score: Math.max(1, Math.min(5, Number(score.toFixed(2)))),
    reason: reasons.join(", ") || "complete",
    completeness: Number(completeness.toFixed(2)),
  };
}

export const QUALIFICATION_THRESHOLDS = {
  minCompleteness: 0.8,
  /** Photo clarity threshold below which we fall back to default character. */
  minPhotoClarityScore: 0.3,
} as const;

export function isQualified(args: {
  completeness: number;
  photoClarityScore?: number | null;
}): { qualified: boolean; reason: string } {
  if (args.completeness < QUALIFICATION_THRESHOLDS.minCompleteness) {
    return {
      qualified: false,
      reason: `form incomplete (${Math.round(args.completeness * 100)}% < ${
        QUALIFICATION_THRESHOLDS.minCompleteness * 100
      }%)`,
    };
  }
  // Low-clarity photo doesn't disqualify — we fall back to the default character.
  // It just gets logged in book.qualificationReason for ops visibility.
  return { qualified: true, reason: "qualified" };
}
