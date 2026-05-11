import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_API_KEY });
const IMG = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80";

async function try_(model, input) {
  try {
    await fal.subscribe(model, { input, logs: false });
    console.log(`${model} ✓`);
  } catch (e) {
    console.log(`${model} ✗ ${e.status ?? ""} ${(e.message ?? "").slice(0, 80)}`);
  }
}

await try_("fal-ai/nano-banana-pro", { prompt: "Stage", image_url: IMG });
await try_("fal-ai/nano-banana-pro/edit", { prompt: "Stage", image_urls: [IMG] });
await try_("fal-ai/nano-banana", { prompt: "Staged kitchen" });
