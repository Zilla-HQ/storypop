import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_API_KEY });

async function probe(model, input) {
  try {
    const r = await fal.subscribe(model, { input, logs: false });
    const url = r?.data?.images?.[0]?.url;
    console.log(`${model} ✓ ${url ? url.slice(0, 70) : "(no image url)"}`);
  } catch (e) {
    console.log(`${model} ✗ ${e.status ?? ""} ${(e.message ?? String(e)).slice(0, 120)}`);
  }
}

const KITCHEN =
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80";

await probe("fal-ai/nano-banana/edit", { prompt: "Add modern furniture", image_urls: [KITCHEN] });
await probe("fal-ai/flux/dev/image-to-image", { prompt: "Staged kitchen", image_url: KITCHEN, strength: 0.7 });
await probe("fal-ai/flux/schnell", { prompt: "Staged modern kitchen", num_images: 1 });
