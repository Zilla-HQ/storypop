import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

// We use Claude Haiku for vision — one less vendor to fund, same quality
// for our scoring use case.
const apiKey = env("ANTHROPIC_API_KEY");
const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")!;

const client = apiKey ? new Anthropic({ apiKey }) : null;

const PHOTO_SCORE_PROMPT = `You are rating an MLS real estate listing photo on quality (1-5).

5 = professional photographer, proper lighting, wide-angle, staged or great natural light.
4 = good but not pro; slight exposure issues or minor clutter.
3 = phone photo, average light, some clutter or dated decor.
2 = bad lighting, poorly framed, clutter, or obviously empty without staging.
1 = unusable — blurry, too dark, or unintelligible.

Return ONLY a JSON object with no surrounding text:
{"score": <1-5>, "reason": "<one-line reason>"}`;

export interface PhotoScore {
  score: number; // 1-5
  reason: string;
}

function parseJsonLoose<T>(raw: string, fallback: T): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

async function fetchAsBase64(imageUrl: string): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const res = await fetch(imageUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`fetch ${imageUrl} failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const mediaType = (
    contentType.startsWith("image/png")
      ? "image/png"
      : contentType.startsWith("image/gif")
        ? "image/gif"
        : contentType.startsWith("image/webp")
          ? "image/webp"
          : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType };
}

async function claudeVisionJson<T>(args: {
  imageUrl: string;
  prompt: string;
  fallback: T;
  maxTokens?: number;
}): Promise<T> {
  if (!client) return args.fallback;
  let img: { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };
  try {
    img = await fetchAsBase64(args.imageUrl);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[vision] image fetch failed: ${e}`);
    return args.fallback;
  }
  const resp = await client.messages.create({
    model,
    max_tokens: args.maxTokens ?? 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.data },
          },
          { type: "text", text: args.prompt },
        ],
      },
    ],
  });
  const block = resp.content[0];
  const raw = block && block.type === "text" ? block.text : "";
  return parseJsonLoose(raw, args.fallback);
}

export async function scorePhotoQuality(imageUrl: string): Promise<PhotoScore> {
  return claudeVisionJson<PhotoScore>({
    imageUrl,
    prompt: PHOTO_SCORE_PROMPT,
    fallback: { score: 3, reason: "parse error" },
    maxTokens: 200,
  });
}

export async function scoreListingPhotos(urls: string[]): Promise<{
  avgScore: number;
  perPhoto: PhotoScore[];
}> {
  const sampled = urls.slice(0, 3);
  const perPhoto = await Promise.all(sampled.map(scorePhotoQuality));
  const avg =
    perPhoto.reduce((sum, p) => sum + p.score, 0) / Math.max(1, perPhoto.length);
  return { avgScore: Number(avg.toFixed(2)), perPhoto };
}

const QC_PROMPT = `You are QC'ing an AI-generated virtually-staged interior real-estate photo.
Look for artifacts: misplaced doors, floating or melting furniture, distorted geometry,
duplicate/triplicated objects, hands/limbs, warped lines, impossible perspective.

Return ONLY a JSON object with no surrounding text:
{"score": <1-5>, "artifacts": "<short list or 'none'>"}
5 = photorealistic, no artifacts. 3 = subtle but noticeable issues. 1 = clearly AI-generated/broken.`;

export interface QCResult {
  score: number;
  artifacts: string;
}

export async function qcStagedPhoto(imageUrl: string): Promise<QCResult> {
  return claudeVisionJson<QCResult>({
    imageUrl,
    prompt: QC_PROMPT,
    fallback: { score: 5, artifacts: "stub: ANTHROPIC_API_KEY missing" },
    maxTokens: 200,
  });
}
