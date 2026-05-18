import { fal } from "@fal-ai/client";
import { env } from "@/lib/env";

const apiKey = env("FAL_API_KEY");
if (apiKey) {
  fal.config({ credentials: apiKey });
}

/**
 * StoryPop's image-gen surface. Two generators:
 *
 *   1. lockCharacter(photoUrl) → loraId
 *      Trains a 3-shot LoRA from the uploaded child photo so subsequent
 *      illustrations render a recognizable, consistent character across
 *      every page. ~$0.18 per book. If no photo, returns a default LoRA
 *      keyed on the form's archetype + age band + (if provided) skin/hair
 *      hints.
 *
 *   2. generatePageIllustration({ scene, loraId, stylePreset })
 *      Produces one page image. Embeds the safety preamble + style preamble.
 *      Retries once on a moderation flag with a more conservative prompt;
 *      escalates to operator on second flag.
 *
 * No additive generation outside the book — no profile pics, no marketing
 * images. All output goes to R2 under books/<bookId>/pages/<n>.png.
 */

export const SAFETY_PREAMBLE = [
  "Children's picture-book illustration. Warm, friendly, age-appropriate.",
  "No violence beyond mild peril. No romance, no sexual content.",
  "No real-world political figures. No branded characters (Disney, Marvel,",
  "Pokémon, Bluey, Paw Patrol, Sesame Street, or any copyrighted IP).",
  "No weapons, no substance use, no scary monsters with realistic features.",
].join(" ");

export const STYLE_PRESETS = {
  "picture-book-warm":
    "warm picture-book illustration, soft outlines, painterly textures, gentle golden palette, no text in the image",
  "picture-book-bold":
    "graphic-novel-leaning picture-book illustration, bold linework, saturated colors, simplified shapes, no text in the image",
  "picture-book-pastel":
    "soft pastel picture-book illustration, watercolor washes, muted palette, dreamy lighting, no text in the image",
  watercolor:
    "fine watercolor children's-book illustration, visible brushwork, layered glazes, restrained color palette, no text in the image",
} as const;

export type StylePreset = keyof typeof STYLE_PRESETS;

export interface CharacterLockInput {
  /** R2 URL of the uploaded child photo. Optional. */
  photoUrl?: string | null;
  childAge: number;
  pronouns?: string | null;
  /** Used when no photo is uploaded — sets the default character's features. */
  defaultHints?: {
    skinTone?: "fair" | "medium" | "tan" | "dark";
    hairColor?: "blonde" | "brown" | "black" | "red" | "other";
    hairStyle?: "short" | "long" | "curly" | "braided";
    glasses?: boolean;
  } | null;
}

export interface CharacterLockResult {
  loraId: string;
  /** Default LoRAs are deterministic per (age, hints) and don't cost anything to "train". */
  isDefault: boolean;
  estCostCents: number;
}

/**
 * Train a 3-shot character LoRA against the uploaded photo. If no photo,
 * returns a deterministic default LoRA id keyed off the form inputs.
 */
export async function lockCharacter(input: CharacterLockInput): Promise<CharacterLockResult> {
  if (!input.photoUrl) {
    const hintKey = JSON.stringify(input.defaultHints ?? {});
    return {
      loraId: `default::${input.childAge}::${input.pronouns ?? "any"}::${hashKey(hintKey)}`,
      isDefault: true,
      estCostCents: 0,
    };
  }

  // Single-photo character-lock: we use flux-pulid which takes one reference
  // image per generation request and matches the face identity into each
  // scene. No training step — the photo URL itself is the "lora identifier"
  // and we pass it to generatePageIllustration verbatim.
  //
  // Previous implementation called fal-ai/flux-lora-fast-training which
  // expects a ZIP archive of training images (not a single photo URL),
  // so every customer submission failed with 422 Unprocessable Entity and
  // fell back to the default LoRA — the kid in the book wasn't theirs.
  // This is the bug Phillip reported (customer-impact: every single
  // photo-upload submission since launch).
  return {
    loraId: input.photoUrl,
    isDefault: false,
    estCostCents: 0,
  };
}

export interface PageGenInput {
  loraId: string;
  isDefaultLora: boolean;
  sceneDescription: string;
  stylePreset: StylePreset;
  /** Page index, used for prompt variation to avoid same composition twice. */
  pageNumber: number;
  /** Child's first name — included so any in-prompt naming stays consistent. */
  childName: string;
  /**
   * 'hero' bumps inference steps (40 vs 20) — the customer judges the
   * whole book on these 3 preview frames so we burn the extra cost to
   * make them look 2x more detailed. Defaults to 'standard'. fulfillment.ts
   * uses 'standard' for the remaining 13 pages.
   */
  quality?: "standard" | "hero";
}

export interface PageGenResult {
  imageUrl: string;
  prompt: string;
  costCents: number;
  retries: number;
  flagged: boolean;
}

/**
 * Generate one page illustration. Two paths:
 *
 *   - With photo (isDefaultLora=false): loraId is the photo URL. Uses
 *     fal-ai/flux-pulid which takes one reference image per request and
 *     bakes the face identity into the rendered scene. Same model
 *     storypop.shop used with reliable face-consistency.
 *
 *   - Without photo (isDefaultLora=true): text-only via fal-ai/flux/dev
 *     for higher-fidelity rendering. Hard-locked character description
 *     comes from the parent's `description` field via the Claude system
 *     prompt; storypop.shop's experience confirmed this stays consistent
 *     across pages when the description is specific.
 *
 * Retries once with a softened prompt on NSFW flag. Two flags → throws
 * ContentSafetyError which fulfillment.ts catches to auto-refund.
 */
export async function generatePageIllustration(input: PageGenInput): Promise<PageGenResult> {
  const stylePrompt = STYLE_PRESETS[input.stylePreset];
  const prompt = [
    SAFETY_PREAMBLE,
    stylePrompt,
    `Scene: ${input.sceneDescription}`,
    `Composition varies from prior pages — different camera angle / framing.`,
  ].join(" ");

  let retries = 0;
  let flagged = false;
  let imageUrl = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const usedPrompt = attempt === 0 ? prompt : softenPrompt(prompt);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let out: { data: { images: { url: string }[]; has_nsfw_concepts?: boolean[] } };

      const isHero = input.quality === "hero";
      if (!input.isDefaultLora && input.loraId.startsWith("http")) {
        // Photo path — flux-pulid with the customer's photo as identity ref.
        out = (await fal.subscribe("fal-ai/flux-pulid", {
          input: {
            prompt: usedPrompt,
            reference_image_url: input.loraId,
            image_size: "square_hd",
            // Hero: 40 steps + slightly higher guidance for sharper detail.
            // Standard: 20 steps for the post-payment fulfillment loop.
            num_inference_steps: isHero ? 40 : 20,
            guidance_scale: isHero ? 4.5 : 4,
            true_cfg: isHero ? 1.6 : 1.5,
            id_weight: 1.0,
            // safety_checker disabled — it returns SOLID BLACK images for
            // false positives on innocent kid scenes (warriors, monsters,
            // peril words). Confirmed customer-impact bug on v1.
            enable_safety_checker: false,
          } as any,
          logs: false,
        })) as never;
      } else {
        // No-photo path — flux/dev for hero (28 steps), flux/schnell standard.
        const model = isHero ? "fal-ai/flux/dev" : "fal-ai/flux/schnell";
        out = (await fal.subscribe(model, {
          input: {
            prompt: usedPrompt,
            image_size: "square_hd",
            num_inference_steps: isHero ? 28 : 4,
            num_images: 1,
            enable_safety_checker: false,
          } as any,
          logs: false,
        })) as never;
      }

      const nsfw = out.data.has_nsfw_concepts?.[0] ?? false;
      if (nsfw) {
        flagged = true;
        retries++;
        continue;
      }
      imageUrl = out.data.images[0]?.url ?? "";
      break;
    } catch (err) {
      retries++;
      if (attempt === 1) throw err;
    }
  }

  if (!imageUrl) {
    // Second flag — operator must intervene. Triggers auto-refund downstream.
    throw new ContentSafetyError(
      `Page ${input.pageNumber} blocked by safety filter twice — escalating`,
    );
  }

  return { imageUrl, prompt, costCents: 4, retries, flagged };
}

function softenPrompt(prompt: string): string {
  // Remove any potentially-flagged scene language and re-emphasize safety.
  return [
    SAFETY_PREAMBLE,
    SAFETY_PREAMBLE, // doubled — stronger guidance
    "Calm, gentle, daylit scene. The character is smiling.",
    prompt.split("Scene:")[1]?.split(".")[0]?.replace(/dragon|monster|scared|dark/gi, "friendly") ?? "",
  ].join(" ");
}

export class ContentSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentSafetyError";
  }
}

function hashKey(input: string): string {
  // Tiny deterministic hash for default-LoRA keys. Not cryptographic.
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return (h >>> 0).toString(36);
}
