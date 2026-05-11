/**
 * Test different (source, prompt, model) combinations to find one that
 * genuinely preserves the kitchen and only changes the styling.
 * Writes each variant's after-URL to stdout so we can inspect manually.
 */
import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_API_KEY });

const VARIANTS = [
  {
    label: "A: empty kitchen + Kontext + minimal-additions prompt",
    sourceUrl:
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1400&q=85",
    model: "fal-ai/flux-pro/kontext",
    input: {
      guidance_scale: 4.5,
      prompt:
        "Add minimal but tasteful styling to this empty kitchen: a small wooden chopping board with a styled bowl of lemons on the counter, a single styled cookbook stack, a small olive-tree plant in a stoneware pot, and two upholstered counter stools at the island. Keep absolutely everything else IDENTICAL — same walls, same cabinets, same backsplash, same countertops, same floor, same ceiling, same windows, same lighting, same camera angle.",
    },
  },
  {
    label: "B: furnished kitchen + Kontext + refresh prompt",
    sourceUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=85",
    model: "fal-ai/flux-pro/kontext",
    input: {
      guidance_scale: 4.5,
      prompt:
        "Refresh the styling of this exact kitchen. Swap the existing accessories with new ones in a warm modern style: a wooden chopping board, a fresh bowl of lemons, a small olive-tree plant, neat cookbooks, a runner rug. Keep all walls, cabinets, countertops, appliances, windows, and the camera angle EXACTLY identical — only change the accessories sitting on the counter and any small movable items.",
    },
  },
  {
    label: "C: furnished kitchen + nano-banana/edit + restyle prompt",
    sourceUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=85",
    model: "fal-ai/nano-banana-pro/edit",
    input: {
      prompt:
        "Restyle this same kitchen with new accessories and decor. Add: wooden cutting board with sourdough, fresh lemons, an olive-tree plant in a stoneware pot, a stack of cookbooks, neat coffee station. Keep walls, cabinets, countertops, windows, floor, and camera angle identical to the source. No new architectural elements.",
      image_urls: [],
    },
  },
];

for (const v of VARIANTS) {
  console.log(`\n=== ${v.label} ===`);
  console.log(`  source: ${v.sourceUrl.slice(0, 80)}`);
  try {
    const input = { ...v.input, num_images: 1, output_format: "jpeg" };
    if (v.model.includes("kontext")) input.image_url = v.sourceUrl;
    if (v.model.includes("edit")) input.image_urls = [v.sourceUrl];
    const r = await fal.subscribe(v.model, { input, logs: false });
    const url = r?.data?.images?.[0]?.url ?? r?.data?.image?.url;
    console.log(`  AFTER: ${url}`);
  } catch (e) {
    console.log(`  FAIL: ${e.message?.slice(0, 200)}`);
  }
}
