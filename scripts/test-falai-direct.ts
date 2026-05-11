import { generateStagedPreview } from "@/lib/falai";

async function main() {
  const url =
    "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1503101014532268524/original/59b05a14-6115-417a-af8e-dbc68f863486.jpeg";
  console.log("Testing fal.ai with one of William's actual listing photos...");
  console.log(`Source: ${url}`);
  try {
    const r = await generateStagedPreview({
      sourceImageUrl: url,
      styleFragment: "warm modern, golden hour, magazine-grade",
      servicePrompt:
        "Re-light and re-grade this Airbnb listing photo to magazine-grade quality: cinematic golden-hour daylight, bright lifted highlights, deep clean whites with restored shadow detail, saturated yet natural color, polished glass and surfaces, sharpened architectural features. STRICT: do not add, remove, or move furniture, decor, art, plants, or fixtures. Same room, same shot — only color, light, exposure, white balance, and clarity change.",
    });
    console.log(`✓ fal.ai SUCCESS`);
    console.log(`  Output URL:   ${r.url}`);
    console.log(`  Cost:         $${(r.costCents / 100).toFixed(2)}`);
  } catch (err) {
    console.error(`✗ fal.ai FAILED:`);
    console.error(err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
