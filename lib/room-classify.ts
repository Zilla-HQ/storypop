import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const apiKey = env("ANTHROPIC_API_KEY");
const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")!;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export type RoomKind =
  | "kitchen"
  | "living_room"
  | "dining_room"
  | "bedroom"
  | "bathroom"
  | "office"
  | "exterior_front"
  | "exterior_back"
  | "patio"
  | "pool"
  | "garage"
  | "hallway"
  | "floor_plan"
  | "other";

interface Classification {
  kind: RoomKind;
  empty: boolean; // is the room empty (good for staging) or already furnished?
  stagingValue: number; // 1-5: how much would virtual staging help this photo?
  /**
   * 1-5: how complex is the room's geometry / architectural detail?
   *   1 = box room with flat walls, simple ceiling, minimal trim (easiest)
   *   2 = standard room with one notable feature (single window, basic kitchen island)
   *   3 = moderate detail (cathedral ceiling, decorative molding, fireplace)
   *   4 = lots of architectural detail (multiple archways, columns, wainscoting)
   *   5 = complex architectural showpiece (spiral staircase, vaulted entry,
   *       multi-level open foyer, atrium) — fal.ai Kontext struggles to
   *       preserve these reliably and tends to hallucinate
   *
   * The pipeline prefers low-complexity rooms because the staging /
   * enhancement model is more faithful when there's less structure to
   * preserve.
   */
  complexity: number;
}

const PROMPT = `Classify this real estate listing photo.

Note: "floor_plan" is for any top-down architectural drawing showing the layout of rooms (with walls, doors, often labels and dimensions). NOT for furnished room photos taken from inside.

Return ONLY this JSON object with no surrounding text:
{
  "kind": one of "kitchen" | "living_room" | "dining_room" | "bedroom" | "bathroom" | "office" | "exterior_front" | "exterior_back" | "patio" | "pool" | "garage" | "hallway" | "floor_plan" | "other",
  "empty": true if the room is empty or sparsely furnished (good staging target), false if already well-furnished,
  "stagingValue": 1-5 where 5 = virtual staging would dramatically improve this photo, 1 = staging adds nothing,
  "complexity": 1-5 architectural complexity. 1 = simple box room with flat walls, simple ceiling. 2 = standard room with a window or two. 3 = moderate (fireplace, cathedral ceiling). 4 = lots of detail (archways, columns, wainscoting). 5 = complex architectural showpiece (SPIRAL STAIRCASE, vaulted multi-level entryway, atrium, exposed beams + dramatic ceilings) — these are very hard to AI-edit faithfully.
}`;

async function fetchAsBase64(imageUrl: string) {
  const res = await fetch(imageUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`fetch ${imageUrl} failed: ${res.status}`);
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  const mediaType = (
    ct.startsWith("image/png")
      ? "image/png"
      : ct.startsWith("image/webp")
        ? "image/webp"
        : ct.startsWith("image/gif")
          ? "image/gif"
          : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType };
}

const FALLBACK_CLASSIFICATION: Classification = {
  kind: "other",
  empty: true,
  stagingValue: 3,
  complexity: 3,
};

export async function classifyRoom(imageUrl: string): Promise<Classification> {
  if (!client) return FALLBACK_CLASSIFICATION;
  let img: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
  try {
    img = await fetchAsBase64(imageUrl);
  } catch {
    return FALLBACK_CLASSIFICATION;
  }
  const resp = await client.messages.create({
    model,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const block = resp.content[0];
  const raw = block && block.type === "text" ? block.text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    if (!match) return FALLBACK_CLASSIFICATION;
    const parsed = JSON.parse(match[0]) as Partial<Classification>;
    return {
      kind: (parsed.kind as RoomKind | undefined) ?? "other",
      empty: parsed.empty ?? true,
      stagingValue: parsed.stagingValue ?? 3,
      complexity: parsed.complexity ?? 3,
    };
  } catch {
    return FALLBACK_CLASSIFICATION;
  }
}

/**
 * From a list of photo URLs, pick the N best photos to send through the
 * preview pipeline. Empty rooms come first (best for staging — Kontext
 * adds furniture faithfully into open space), then furnished rooms ranked
 * by stagingValue (those go through the ENHANCEMENT path — color/lighting
 * retouch only, no structural changes).
 *
 * Caller branches on `classification.empty`:
 *   - empty=true  → run the staging prompt (adds furniture)
 *   - empty=false → run the enhancement prompt (retouch only)
 *
 * Either way the email is truthful: empties get a real before/after of
 * staged-from-vacant, furnished get a real before/after of retouch.
 *
 * Returns up to N classified photos. Empty array means we couldn't
 * classify any (vision API down etc.) — caller should skip the listing.
 */
// Room kinds that are systematically hard for fal.ai Kontext: foyers /
// hallways always have staircases or transition spaces with complex
// geometry; bathrooms have mirrors that confuse the model;
// floor_plan / exterior / pool / garage / patio shouldn't be staged at all.
const HARD_TO_STAGE_KINDS = new Set<RoomKind>([
  "hallway",
  "bathroom",
  "floor_plan",
  "exterior_front",
  "exterior_back",
  "patio",
  "pool",
  "garage",
  "other",
]);

export async function pickBestForStaging(
  photoUrls: string[],
  count: number,
): Promise<{ url: string; classification: Classification }[]> {
  // Stride-sample across the entire photo array. Realtors usually put
  // dramatic / hero shots (foyers, vaulted entries, exteriors) at indices
  // 0-5; the simple bedrooms / kitchens / dining rooms we actually want
  // for staging are typically at indices 8-20. Sampling stride-wise
  // ensures we see those, not just the first 12.
  const SAMPLE_TARGET = 16;
  const stride = Math.max(1, Math.floor(photoUrls.length / SAMPLE_TARGET));
  const sample: string[] = [];
  for (let i = 0; i < photoUrls.length && sample.length < SAMPLE_TARGET; i += stride) {
    sample.push(photoUrls[i]);
  }
  // Also force-include first 3 in case stride skipped them (small listings)
  for (const url of photoUrls.slice(0, 3)) {
    if (!sample.includes(url) && sample.length < SAMPLE_TARGET) sample.unshift(url);
  }

  const classified = await Promise.all(
    sample.map(async (url) => ({
      url,
      classification: await classifyRoom(url),
    })),
  );

  // Drop hard-to-stage room kinds entirely and reject anything with
  // architectural complexity >= 4 (spiral staircases, vaulted entryways,
  // multi-level foyers). Prefer simple boxy rooms — bedrooms, basic living
  // rooms, kitchens, dining rooms — which fal.ai handles faithfully.
  const candidates = classified.filter(
    (c) =>
      !HARD_TO_STAGE_KINDS.has(c.classification.kind) &&
      c.classification.complexity <= 3,
  );

  // If filtering throws away EVERYTHING (rare — listing has only foyers
  // and bathrooms), relax the complexity filter as a last resort. Still
  // skip floor_plan + exterior + pool kinds.
  const finalCandidates =
    candidates.length > 0
      ? candidates
      : classified.filter(
          (c) =>
            !["floor_plan", "exterior_front", "exterior_back", "pool", "garage"].includes(
              c.classification.kind,
            ),
        );

  // Within the eligible set: empty rooms first (best for staging),
  // then by stagingValue (high), then by complexity ASC (simpler is more
  // faithful — pick the EASIEST simple room over the slightly-harder one).
  finalCandidates.sort((a, b) => {
    if (a.classification.empty !== b.classification.empty) {
      return a.classification.empty ? -1 : 1;
    }
    if (a.classification.stagingValue !== b.classification.stagingValue) {
      return b.classification.stagingValue - a.classification.stagingValue;
    }
    return a.classification.complexity - b.classification.complexity;
  });
  return finalCandidates.slice(0, count);
}
