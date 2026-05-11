import sharp from "sharp";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Overlay a text watermark on an image buffer.
 *
 * Used for previews ("PREVIEW — Realscale") and NAR disclosure
 * ("Virtually Staged") on fulfilled photos.
 *
 * Implementation history:
 * - v1 used inline SVG <text> — Vercel Lambda fontconfig fell back to
 *   a font without Latin glyphs, producing tofu/garbled output that
 *   recipients perceived as scammy. Likely the cause of zero
 *   conversions in early launch.
 * - v2 used sharp's libvips/pango text path — same issue on Lambda
 *   (libvips and librsvg both depend on the Lambda fontconfig setup
 *   which is unreliable for non-bundled fonts).
 * - v3 (current) uses pre-rendered PNG watermarks bundled in
 *   public/watermarks/. No runtime font dependency. Generated locally
 *   via scripts/gen-wm.mjs using whatever fonts are available there.
 *
 * The bundled PNGs are oversized (658px+ wide). At runtime we resize
 * to a target fraction of the image width — keeps text readable on
 * mobile inbox previews without dominating the photo.
 */
type WatermarkText = "Virtually Staged" | "Enhanced" | "PREVIEW — Realscale";

const WATERMARK_FILE: Record<WatermarkText, string> = {
  "Virtually Staged": "virtually-staged.png",
  "Enhanced": "enhanced.png",
  "PREVIEW — Realscale": "preview.png",
};

function loadWatermarkPng(text: string): Buffer {
  const file = (WATERMARK_FILE as Record<string, string>)[text] ?? "virtually-staged.png";
  // process.cwd() in Vercel = repo root. public/ is bundled into the
  // serverless function automatically.
  const p = path.join(process.cwd(), "public", "watermarks", file);
  return readFileSync(p);
}

export async function applyTextWatermark(
  input: Buffer,
  text: string,
  opts?: { position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"; opacity?: number },
): Promise<Buffer> {
  const position = opts?.position ?? "bottom-right";
  // Opacity is baked into the bundled PNG (~78%); only honor a custom
  // opacity if the caller is overriding to be lighter than that.
  const _opacity = opts?.opacity;

  const meta = await sharp(input).metadata();
  const imgW = meta.width ?? 1200;
  const imgH = meta.height ?? 800;

  // Scale watermark to ~28% of image width — large enough to cover any
  // garbled SVG-era watermark underneath, legible on mobile email.
  const targetWidth = Math.round(imgW * 0.28);

  const wmPng = loadWatermarkPng(text);
  const wmBuf = await sharp(wmPng).resize(targetWidth).png().toBuffer();
  const wmMeta = await sharp(wmBuf).metadata();
  const wmW = wmMeta.width ?? targetWidth;
  const wmH = wmMeta.height ?? Math.round(targetWidth * 0.2);
  const margin = Math.max(12, Math.round(imgW * 0.012));

  const x = position.includes("right") ? imgW - wmW - margin : margin;
  const y = position.includes("bottom") ? imgH - wmH - margin : margin;

  return sharp(input)
    .composite([{ input: wmBuf, top: y, left: x }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
