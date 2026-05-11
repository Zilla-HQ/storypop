import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_API_KEY });

const SRC =
  "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1400&q=85";

const prompt =
  "Stage this exact kitchen with magazine-quality decor: a styled large kitchen island with two upholstered counter stools, a wooden chopping board with fresh sourdough, a bowl of lemons, a curated cluster of cookbooks, a small olive-tree plant in a stoneware pot, a framed art print on a free wall, neat coffee station, a runner rug. Style: warm modern, light wood, soft white, matte black accents, fresh greenery. Keep the exact same walls, windows, cabinets, floor, ceiling, and camera angle. Photo-realistic.";

const candidates = [
  "fal-ai/flux-pro/kontext",
  "fal-ai/flux-pro/kontext/text-to-image",
  "fal-ai/flux-pro/kontext-max",
  "fal-ai/flux/dev/redux",
];

for (const model of candidates) {
  console.log(`\n=== ${model} ===`);
  try {
    const r = await fal.subscribe(model, {
      input: {
        prompt,
        image_url: SRC,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: "jpeg",
      },
      logs: false,
    });
    const url = r?.data?.images?.[0]?.url ?? r?.data?.image?.url;
    console.log("  ✓", url ? url.slice(0, 90) : JSON.stringify(r).slice(0, 200));
  } catch (e) {
    console.log("  ✗", (e.message ?? String(e)).slice(0, 200));
  }
}
