import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const FAL_API_KEY = process.env.FAL_API_KEY?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/** Diagnostic: reports fal.ai key presence + tries one call against a
 *  caller-supplied URL so we can isolate auth vs source-fetch failures.
 *  Pass `?source=r2-sample` to test fal.ai against a server-side-generated
 *  R2 signed URL (no HTML encoding issues). */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  let testUrl = url.searchParams.get("url") ??
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=85";
  if (url.searchParams.get("source") === "r2-sample") {
    const { signedR2Url } = await import("@/lib/r2");
    testUrl = await signedR2Url("samples/services/photo-staging-before.jpg", 3600);
  }

  const keyPrefix = FAL_API_KEY ? FAL_API_KEY.slice(0, 8) : null;
  const keyLen = FAL_API_KEY?.length ?? 0;

  if (!FAL_API_KEY) {
    return NextResponse.json({ error: "FAL_API_KEY not set in env" });
  }
  fal.config({ credentials: FAL_API_KEY });

  try {
    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt: "Brighten this photo slightly. STRICT: keep the exact composition.",
        image_url: testUrl,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: "jpeg",
      },
      logs: false,
    });
    type FalResult = { data?: { images?: { url?: string }[] } };
    const r = result as FalResult;
    const out = r?.data?.images?.[0]?.url ?? null;
    return NextResponse.json({
      ok: true,
      keyPrefix,
      keyLen,
      testUrl,
      output: out,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      keyPrefix,
      keyLen,
      testUrl,
      error: (e as Error).message,
      stack: (e as Error).stack?.slice(0, 600),
    });
  }
}
