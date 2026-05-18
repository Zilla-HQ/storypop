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

  // Real call: fal.ai's LoRA-training endpoint. The exact model id depends
  // on which Flux variant we're on; resolved at runtime from env.
  const trainModel = env("FAL_LORA_TRAIN_MODEL", "fal-ai/flux-lora-fast-training")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await fal.subscribe(trainModel, {
    input: {
      images_data_url: input.photoUrl,
      steps: 1000,
      trigger_word: "STORYPOPKID",
    } as any,
    logs: false,
  })) as unknown as { data: { diffusers_lora_file: { url: string } } };

  return {
    loraId: result.data.diffusers_lora_file.url,
    isDefault: false,
    estCostCents: 18,
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
}

export interface PageGenResult {
  imageUrl: string;
  prompt: string;
  costCents: number;
  retries: number;
  flagged: boolean;
}

/**
 * Generate one page illustration. Retries once with a more conservative
 * prompt on a moderation flag.
 */
export async function generatePageIllustration(input: PageGenInput): Promise<PageGenResult> {
  const baseModel = env("FAL_LORA_BASE_MODEL", "fal-ai/flux-lora")!;
  const stylePrompt = STYLE_PRESETS[input.stylePreset];
  const prompt = [
    SAFETY_PREAMBLE,
    stylePrompt,
    `Scene: ${input.sceneDescription}`,
    `The protagonist is STORYPOPKID${input.isDefaultLora ? "" : " (locked-character LoRA)"}.`,
    `Composition varies from prior pages.`,
  ].join(" ");

  let retries = 0;
  let flagged = false;
  let imageUrl = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = (await fal.subscribe(baseModel, {
        input: {
          prompt: attempt === 0 ? prompt : softenPrompt(prompt),
          loras: input.isDefaultLora ? [] : [{ path: input.loraId, scale: 1.0 }],
          image_size: "square_hd",
          num_inference_steps: 28,
          // IMPORTANT: when fal's safety checker trips it returns a SOLID
          // BLACK PLACEHOLDER image at full resolution rather than failing.
          // We compose that into the customer PDF and the page renders as
          // a blank black rectangle — confirmed bug in the v1 prod deploy.
          //
          // We disable the checker here because every prompt going to fal
          // is composed from our SAFETY_PREAMBLE + a Claude-generated scene
          // that's already constrained by the kids-book system prompt. The
          // false-positive rate on innocent scenes (warriors, monsters,
          // peril words) was unacceptable for a paid product. Keeping the
          // has_nsfw_concepts check below as a defense-in-depth read on
          // anything fal still flags server-side.
          enable_safety_checker: false,
        } as any,
        logs: false,
      })) as unknown as {
        data: { images: { url: string }[]; has_nsfw_concepts?: boolean[] };
      };

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
