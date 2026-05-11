import { fal } from "@fal-ai/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const FAL_MODEL = "fal-ai/nano-banana-pro/edit";

if (!process.env.FAL_API_KEY) throw new Error("FAL_API_KEY missing");
if (!process.env.R2_ACCOUNT_ID) throw new Error("R2_ACCOUNT_ID missing");
fal.config({ credentials: process.env.FAL_API_KEY });

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET ?? "relist-photos";

const SAMPLES = [
  {
    id: "kitchen-modern",
    caption: "Kitchen · Modern preset",
    roomHint: "kitchen",
    style: "modern contemporary, clean lines, neutral palette, soft natural light, minimalist furniture and accessories",
    sourceUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "living-farmhouse",
    caption: "Living room · Farmhouse preset",
    roomHint: "living room",
    style: "modern farmhouse, warm wood tones, shiplap-style accents, cozy linen and wool textiles, natural light",
    sourceUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bedroom-coastal",
    caption: "Bedroom · Coastal preset",
    roomHint: "bedroom",
    style: "coastal, light airy whites and soft blues, driftwood accents, natural linen, ocean light",
    sourceUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "dining-midcentury",
    caption: "Dining · Mid-Century preset",
    roomHint: "dining room",
    style: "mid-century modern, walnut and teak, atomic-era silhouettes, warm palette",
    sourceUrl: "https://images.unsplash.com/photo-1617104551722-3b2d51366400?auto=format&fit=crop&w=1200&q=80",
  },
];

async function fetchToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
async function uploadR2(key, body, contentType = "image/jpeg") {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

async function generate(sample) {
  console.log(`— ${sample.id} —`);
  const beforeBuf = await fetchToBuffer(sample.sourceUrl);
  await uploadR2(`samples/${sample.id}-before.jpg`, beforeBuf);
  console.log(`  before uploaded`);

  const prompt = [
    `Edit this exact photograph to virtually stage the ${sample.roomHint}.`,
    `Add photo-realistic furniture and decor: ${sample.style}.`,
    "STRICT: keep the exact same camera angle, walls, ceiling, floor, windows, doors,",
    "and architectural features identical to the source. Match the existing lighting and",
    "shadows. Do not change the room type, layout, or perspective.",
    "Photo-realistic interior architectural photography. No text, no watermarks.",
  ].join(" ");

  const result = await fal.subscribe(FAL_MODEL, {
    input: { prompt, image_urls: [sample.sourceUrl], num_images: 1, output_format: "jpeg" },
    logs: false,
  });
  const genUrl = result?.data?.images?.[0]?.url;
  if (!genUrl) throw new Error("fal.ai returned no image");
  const afterBuf = await fetchToBuffer(genUrl);
  await uploadR2(`samples/${sample.id}-after.jpg`, afterBuf);
  console.log(`  after uploaded`);
  return { id: sample.id };
}

for (const s of SAMPLES) {
  try { await generate(s); } catch (e) { console.error(`  FAIL: ${e.message}`); }
}
console.log("done");
