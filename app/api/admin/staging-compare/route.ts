import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { fal } from "@fal-ai/client";
import { uploadToR2, signedR2Url } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const FAL_API_KEY = process.env.FAL_API_KEY?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

const STAGING_PROMPT =
  "Replace the existing room contents with modern contemporary furniture: a low-profile sectional sofa in light grey, a natural-wood coffee table with a small vase, a soft cream wool area rug, a tall potted plant, a slim floor lamp, framed art on the wall. Keep the walls, floor, ceiling, windows, doors, and architectural features identical to the source. Match existing lighting. Photo-realistic interior real-estate photography. No text, no watermarks.";

/**
 * Run one source photo through several fal.ai model variants to compare
 * which one preserves structure faithfully. Returns R2-hosted URLs of
 * each output for visual comparison.
 *
 *   POST /api/admin/staging-compare?url=<sourceUrl>
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!FAL_API_KEY) return NextResponse.json({ error: "FAL_API_KEY not set" }, { status: 500 });
  fal.config({ credentials: FAL_API_KEY });

  const url = new URL(req.url);
  const sourceUrl = url.searchParams.get("url");
  if (!sourceUrl) return NextResponse.json({ error: "?url= required" }, { status: 400 });

  // Mirror to R2 (fal.ai sometimes 403s on Zillow CDN)
  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) {
    return NextResponse.json(
      { error: `source fetch ${sourceRes.status}` },
      { status: 502 },
    );
  }
  const sourceBuf = Buffer.from(await sourceRes.arrayBuffer());
  const sourceKey = `staging-compare/source-${Date.now()}.jpg`;
  await uploadToR2(sourceKey, sourceBuf, "image/jpeg");
  const r2SourceUrl = await signedR2Url(sourceKey, 3600);

  // Models to test, ordered roughly from "most faithful" to "most creative".
  // strength values control how far the output can drift from the source —
  // lower = more faithful. ControlNet variants force structural preservation
  // by routing the source through a Canny edge detector first.
  const variants: Array<{
    label: string;
    model: string;
    input: Record<string, unknown>;
  }> = [
    {
      label: "img2img-strength-0.45",
      model: "fal-ai/flux/dev/image-to-image",
      input: {
        prompt: STAGING_PROMPT,
        image_url: r2SourceUrl,
        strength: 0.45,
        num_inference_steps: 28,
        guidance_scale: 5,
        num_images: 1,
        output_format: "jpeg",
      },
    },
  ];

  const trace: Array<Record<string, unknown>> = [];
  const results: Array<{ label: string; url: string }> = [];

  for (const v of variants) {
    try {
      const result = (await fal.subscribe(v.model, { input: v.input, logs: false })) as {
        data?: { images?: { url: string }[] };
      };
      const outUrl = result?.data?.images?.[0]?.url;
      if (!outUrl) {
        trace.push({ label: v.label, error: "no image returned" });
        continue;
      }
      const outRes = await fetch(outUrl);
      const outBuf = Buffer.from(await outRes.arrayBuffer());
      const outKey = `staging-compare/${v.label}-${Date.now()}.jpg`;
      await uploadToR2(outKey, outBuf, "image/jpeg");
      const r2OutUrl = await signedR2Url(outKey, 60 * 60 * 24);
      results.push({ label: v.label, url: r2OutUrl });
      trace.push({ label: v.label, ok: true });
    } catch (e) {
      trace.push({ label: v.label, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    source: r2SourceUrl,
    results,
    trace,
  });
}
