/**
 * Generate one before/after sample per Realscale service for the homepage.
 *   node --env-file=.env.local scripts/generate-service-samples.mjs
 *
 * Picks source images that match what each service actually does in
 * production:
 *   - photo-staging: an EMPTY kitchen, restaged with modern furniture
 *   - twilight-exterior: a daytime exterior, swapped to twilight
 *   - curb-appeal: a bare front yard, refreshed
 *   - pool-mockup / solar-mockup: an actual Mapbox satellite tile of a
 *     real residential property — same source the production pool/solar
 *     pipeline uses, so the sample matches what a real submission produces.
 */
import { fal } from "@fal-ai/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// FLUX.1 Kontext — purpose-built for "edit while preserving source structure".
// Stricter on geometry than nano-banana for the staging use case.
const FAL_MODEL = "fal-ai/flux-pro/kontext";
fal.config({ credentials: process.env.FAL_API_KEY });

const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET ?? "relist-photos";

// Real residential properties (publicly-listed addresses) so the satellite
// tile shows a clear house + yard / roof. Coordinates picked from suburban
// Phoenix / Scottsdale where lots are large and many homes lack pools.
function mapboxSat(lng, lat, zoom = 19) {
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${lng},${lat},${zoom},0/1024x768@2x` +
    `?access_token=${MAPBOX}&attribution=false&logo=false`
  );
}

const SAMPLES = [
  {
    serviceId: "photo-staging",
    // Empty / unfurnished living room — the archetypal "virtual staging"
    // before. Kontext handles empty rooms reliably: there's nothing busy
    // to preserve incorrectly, and the staging additions land in clean
    // wall-to-wall space. Prior kitchen attempts kept failing because the
    // model couldn't tell which kitchen elements were "the same" vs
    // "stage-able."
    sourceUrl:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=85",
    guidanceScale: 4,
    prompt:
      "Edit this exact empty living room photograph by virtually staging it as a high-end real-estate listing. Add: a low-profile sectional sofa in light grey upholstery against the longest wall; a round natural-wood coffee table with a stack of design books and a small ceramic vase; a soft cream wool area rug under the sofa and coffee table; a tall potted fiddle-leaf fig plant in one corner; a slim floor lamp with a linen shade; one or two pieces of framed abstract art on the largest wall; sheer linen curtains framing the windows. STRICT: keep the walls, floor, ceiling, windows, doors, baseboards, and camera angle EXACTLY identical to the source. Do not change room dimensions, perspective, or any architectural element. Match the existing daylight and shadows. Photo-realistic real-estate photography. No text, no watermarks.",
  },
  {
    serviceId: "twilight-exterior",
    sourceUrl:
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=85",
    prompt:
      "Edit this exact exterior photograph into a cinematic twilight scene. Replace the daytime sky with a soft sunset gradient (warm pink and orange transitioning to deep blue). Add warm interior light glowing from the windows. Soft golden-hour highlights on the facade. STRICT: keep the building's geometry, materials, landscaping, and camera angle identical to the source. No text, no watermarks.",
  },
  {
    serviceId: "curb-appeal",
    sourceUrl:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=85",
    prompt:
      "Edit this exact photograph to refresh the curb appeal. Replace the front lawn with manicured emerald sod. Add tasteful planted beds with low evergreen shrubs and seasonal flowers along the walkway. Refresh the trim paint. Add subtle landscape lighting fixtures. STRICT: keep the building's geometry, windows, doors, roof, and camera angle identical to the source. No text, no watermarks.",
  },
  {
    serviceId: "pool-mockup",
    // Drone-aerial shot of a residential property where the full house
    // structure AND the empty grass backyard are clearly visible — that's
    // exactly what the user wants in the sample (see house, see pool added
    // to that house's backyard). Oblique drone perspective beats both the
    // top-down satellite tile (austere, hard to read) and the cinematic
    // close-up (no full house). The prompt explicitly anchors the pool to
    // the grass area behind the visible house.
    sourceUrl:
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1400&q=85",
    guidanceScale: 5,
    prompt:
      "Edit this exact aerial photograph by adding an in-ground rectangular swimming pool in the empty grass backyard immediately behind the visible house. Surround the pool with a light grey concrete or natural-stone patio deck and a few tasteful low landscaping plants along the deck edges. The pool must clearly belong to that specific house — positioned in its backyard, proportional to the lot. STRICT: keep the house structure, roof, walls, driveway, neighboring lots, fences, trees, and the aerial camera angle identical to the source. Photo-realistic. No text, no watermarks.",
  },
  {
    serviceId: "solar-mockup",
    // Vision-validated 5/5 by scripts/pick-best-aerial.mjs (same modern home
    // as twilight-exterior, but they appear on different funnel pages so a
    // homepage visitor never sees the same source twice).
    sourceUrl:
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=85",
    guidanceScale: 5,
    prompt:
      "Edit this exact photograph by adding a tasteful black-framed solar panel array on the south and west-facing roof sections of this home. Panels should be in neat rows, realistic spacing, evenly aligned with the roof edges. Cover roughly 60-70% of the largest unobstructed roof area. STRICT: keep the building's geometry, exterior walls, landscaping, and the camera angle identical to the source. Photo-realistic. No text, no watermarks.",
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

for (const s of SAMPLES) {
  console.log(`— ${s.serviceId} —`);
  try {
    // Re-host the source in R2 so the homepage shows the actual satellite
    // tile / Unsplash photo from our domain.
    const beforeBuf = await fetchToBuffer(s.sourceUrl);
    await uploadR2(`samples/services/${s.serviceId}-before.jpg`, beforeBuf);
    console.log(`  before uploaded (${beforeBuf.length} bytes)`);

    const result = await fal.subscribe(FAL_MODEL, {
      // Kontext takes image_url (singular) + guidance_scale. Per-sample override
      // so individual services can tune strictness vs creativity.
      input: {
        prompt: s.prompt,
        image_url: s.sourceUrl,
        guidance_scale: s.guidanceScale ?? 3.5,
        num_images: 1,
        output_format: "jpeg",
      },
      logs: false,
    });
    const url = result?.data?.images?.[0]?.url;
    if (!url) throw new Error("no image returned");
    const afterBuf = await fetchToBuffer(url);
    await uploadR2(`samples/services/${s.serviceId}-after.jpg`, afterBuf);
    console.log(`  after uploaded (${afterBuf.length} bytes)`);
  } catch (e) {
    console.error(`  FAIL ${s.serviceId}: ${e.message}`);
  }
}
console.log("done");
