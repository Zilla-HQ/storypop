import { fal } from "@fal-ai/client";
import { env } from "@/lib/env";

const apiKey = env("FAL_API_KEY");
if (apiKey) {
  fal.config({ credentials: apiKey });
}

// FLUX.1 Kontext — purpose-built for "edit while preserving source structure".
// Stricter on room geometry than nano-banana, which kept generating different
// rooms when asked to stage. Model can be overridden per-deployment via
// FAL_PREVIEW_MODEL.
const model = env("FAL_PREVIEW_MODEL", "fal-ai/flux-pro/kontext")!;

export interface FalPreviewResult {
  url: string;
  costCents: number;
}

/**
 * Generate a staged preview from a source photo. Costs ~$0.04-0.08/image on
 * Nano Banana Pro. Throws if FAL_API_KEY is missing (caller should catch
 * and log rather than silent-fail).
 */
export type PreviewMode = "staging" | "enhancement";

export async function generateStagedPreview(args: {
  sourceImageUrl: string;
  styleFragment: string;
  roomHint?: string;
  /**
   * "staging"    — for empty/sparse rooms. Adds furniture into the
   *                 open space. Kontext is faithful to walls/floor/ceiling
   *                 because there's nothing to preserve incorrectly.
   * "enhancement" — for already-furnished rooms. Pure retouch (lighting,
   *                 color, clarity). Kontext can't reliably ADD furniture
   *                 into a populated scene so we don't ask it to.
   * Defaults to "enhancement" — the safer default.
   */
  mode?: PreviewMode;
  /** Optional override of the service-specific prompt clause. */
  servicePrompt?: string;
}): Promise<FalPreviewResult> {
  if (!apiKey) {
    throw new Error("FAL_API_KEY is not set");
  }

  const mode: PreviewMode = args.mode ?? "enhancement";

  let serviceClause: string;
  let outerWrap: string[];

  if (args.servicePrompt) {
    // Service-specific override path (pool, solar, twilight, curb-appeal etc.)
    serviceClause = args.servicePrompt;
    outerWrap = [
      `Edit this exact photograph.`,
      serviceClause,
      "STRICT: keep the building's structure, walls, lot, neighbors, and camera angle identical to the source. Photo-realistic. No text, no watermarks.",
    ];
  } else if (mode === "staging") {
    // Virtually stage the room. ALLOWED: any movable / surface / finish
    // change — furniture, decor, area rugs, art, plants, lighting fixtures,
    // paint color, flooring material, hardware, fabric. FORBIDDEN: any
    // architectural change — walls, doorways, windows, staircases,
    // banisters, balconies, ceilings, beams, columns, room geometry.
    serviceClause = `Refresh and stage this room as a high-end real-estate listing. You MAY: place tasteful new furniture (sofa, accent chairs, coffee table, area rug, side tables, lamps), add modern decor (framed art, plants, throw pillows, books, vases), update finishes (paint color, flooring material, light fixtures, hardware), and refresh lighting/color in the style of: ${args.styleFragment}.`;
    outerWrap = [
      `Restage this exact ${args.roomHint ?? "room"} photograph for a high-end real-estate listing.`,
      serviceClause,
      "ABSOLUTELY DO NOT modify, remove, add, relocate, or alter any walls, doorways, doors, windows, staircases, stair treads, banisters, handrails, balusters, balconies, ceilings, ceiling beams, structural columns, archways, room dimensions, or perspective. Every architectural element — including the staircase, every railing, every wall, every window opening — must be in the EXACT same position with the EXACT same shape and material as the source. Same camera angle, same room geometry.",
      "Photo-realistic real-estate photography. No text, no watermarks, no logos.",
    ];
  } else {
    // Furnished room → enhancement. Goal: make the room feel BRIGHTER,
    // WHITER, and MORE MODERN without removing the existing furniture or
    // changing the structure. Prior "magazine retouch" prompt was too
    // conservative — left rooms looking like the same dated room. New
    // prompt explicitly: paint all walls bright white, brighten lighting
    // dramatically, modernize fixtures + finishes, refresh flooring color,
    // declutter visible surfaces. Keep furniture (we can't faithfully
    // remove it) but make the whole space feel new.
    serviceClause =
      "Make this room feel bright, white, modern, and freshly listed. " +
      "DO: paint ALL walls in bright clean white (Benjamin Moore Chantilly Lace or similar). " +
      "DO: brighten the overall lighting dramatically — natural daylight feel, no dark corners. " +
      "DO: update flooring tone if dated (warm light wood preferred over orange wood or beige tile). " +
      "DO: modernize light fixtures, ceiling fans, and switch plates if they're visible and dated. " +
      "DO: declutter visible surfaces (countertops, side tables) of personal items / clutter / pets / plants. " +
      "DO: replace heavy / dark / patterned curtains with simple white linen sheers. " +
      "DO: sharpen detail, balance color, clean white balance. " +
      "DO NOT: remove or relocate the existing furniture (sofas, beds, dining tables, kitchen islands stay where they are). " +
      "DO NOT: alter walls, doorways, windows, room geometry, ceiling structure, staircases, banisters, beams, or columns.";
    outerWrap = [
      `Edit this exact ${args.roomHint ?? "real-estate"} photograph as a high-end real-estate retoucher would for a magazine listing.`,
      serviceClause,
      "Photo-realistic real-estate photography. No text, no watermarks, no logos.",
    ];
  }
  const prompt = outerWrap.join(" ");

  // FLUX.1 Kontext takes image_url (singular). nano-banana's /edit endpoint
  // takes image_urls (plural). Pass both — fal.ai ignores the unused one.
  // Staging gets lower guidance (Kontext stays closer to source structure);
  // enhancement gets the original setting (less drift risk anyway since
  // it's only doing color/lighting).
  const guidanceScale = mode === "staging" ? 2.8 : 3.5;
  const result = (await fal.subscribe(model, {
    input: {
      prompt,
      image_url: args.sourceImageUrl,
      image_urls: [args.sourceImageUrl],
      guidance_scale: guidanceScale,
      num_images: 1,
      output_format: "jpeg",
    },
    logs: false,
  })) as { data?: { images?: { url: string }[] } };

  const url = result.data?.images?.[0]?.url;
  if (!url) {
    throw new Error("fal.ai returned no image");
  }

  // Rough cost estimate — refine once per-model pricing is known.
  return { url, costCents: 6 };
}
