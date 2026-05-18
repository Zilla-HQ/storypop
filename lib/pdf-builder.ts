import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { signedR2Url, uploadToR2 } from "@/lib/r2";

/**
 * Assemble a 12+ page personalized storybook into a print-ready 8.5×8.5"
 * PDF. Cover + dedication + N story spreads + back cover. Uploads the
 * result to R2 and returns the key so the fulfillment step can sign
 * delivery URLs for digital orders or hand the key to Lulu for print.
 *
 * Why a hand-rolled builder and not react-pdf:
 *   - pdf-lib is ~10x lighter than @react-pdf/renderer at runtime
 *   - We need precise control over print-size (8.5×8.5") and a tight
 *     emoji-sanitizer pass (pdf-lib's StandardFonts only encode WinAnsi
 *     — emojis would otherwise crash compile)
 *   - The full v1 surface was ~100 lines, no need for a render tree
 *
 * Input contract:
 *   - story.pages[i].body is the page text shown under the illustration
 *   - storyPageR2Keys[i] is the R2 key for the rendered page image (same
 *     order as story.pages). Falsy entries skip the image and render
 *     text-only — fulfillment.ts decides whether to bail or accept that.
 */

export interface PdfBuilderInput {
  bookId: string;
  childName: string;
  storyTitle?: string;
  dedication?: string;
  pages: { body: string }[];
  /** Same length as pages — R2 key per page. */
  pageR2Keys: (string | null | undefined)[];
}

export interface PdfBuilderResult {
  /** R2 key the assembled PDF was uploaded under. */
  r2Key: string;
  /** Byte size of the uploaded PDF — handy for cost-tracking + sanity. */
  byteLength: number;
}

const SIZE = 612; // 8.5" × 72dpi

/**
 * pdf-lib's StandardFonts encode WinAnsi only. Claude regularly puts
 * sparkle/star emojis ("✨", "🌟") into titles and page bodies which
 * crashes embedFont with "WinAnsi cannot encode 0x2728". Strip them.
 * Smart punctuation gets replaced with the ASCII equivalent so the
 * book still reads right.
 */
function sanitizeForPdf(s: string): string {
  if (!s) return "";
  let out = s
    .replace(/[‘’‚‛]/g, "'") // smart single quotes
    .replace(/[“”„‟]/g, '"') // smart double quotes
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    .replace(/ /g, " "); // nbsp
  // Strip everything outside basic Latin-1 (emoji, CJK, etc.)
  out = out.replace(/[^\x00-\xFF]/g, "");
  return out.replace(/  +/g, " ").trim();
}

/**
 * Fetch a page illustration from R2 by key, refuse to embed
 * suspected solid-color safety-checker placeholders.
 */
async function fetchPageImage(key: string): Promise<Buffer> {
  const url = await signedR2Url(key, 60 * 5);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`pdf-builder: failed to fetch ${key}: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) {
    throw new Error(`pdf-builder: ${key} body is suspiciously small (${buf.length}b)`);
  }
  // Defense-in-depth against the fal-safety-checker-returns-black-image
  // bug. lib/falai.ts already disables the checker, but if a placeholder
  // ever sneaks through it would otherwise render as a black rectangle
  // in the final PDF. Cheap byte-entropy heuristic catches uniform fills.
  if (buf.length < 30 * 1024) {
    const start = Math.min(200, Math.floor(buf.length / 4));
    const end = Math.min(start + 256, buf.length);
    if (end - start >= 32) {
      const sample = buf.subarray(start, end);
      const counts: Record<number, number> = {};
      for (const b of sample) counts[b] = (counts[b] ?? 0) + 1;
      const max = Math.max(...Object.values(counts));
      if (max / sample.length > 0.7) {
        throw new Error(
          `pdf-builder: ${key} looks like a solid-color placeholder (likely safety-filter fallback)`,
        );
      }
    }
  }
  return buf;
}

async function embedImage(pdf: PDFDocument, key: string) {
  const buf = await fetchPageImage(key);
  // fal returns JPEG by default; fall back to PNG.
  try {
    return await pdf.embedJpg(buf);
  } catch {
    return await pdf.embedPng(buf);
  }
}

/**
 * Build the PDF in memory and upload to R2. Returns the key for callers
 * to hand to lib/r2.ts:signedR2Url or to Lulu.
 */
export async function assembleBookPdf(input: PdfBuilderInput): Promise<PdfBuilderResult> {
  const pdf = await PDFDocument.create();
  const display = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  // ─── Cover ──────────────────────────────────────────────────────────
  {
    const page = pdf.addPage([SIZE, SIZE]);
    page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: rgb(1, 0.85, 0.24) });
    if (input.pageR2Keys[0]) {
      try {
        const img = await embedImage(pdf, input.pageR2Keys[0]);
        page.drawImage(img, { x: 56, y: 156, width: 500, height: 380 });
      } catch {
        // missing cover image is non-fatal; we leave the yellow background.
      }
    }
    page.drawText(sanitizeForPdf(input.storyTitle ?? `${input.childName}'s Story`), {
      x: 56,
      y: 80,
      size: 36,
      font: display,
      color: rgb(0.16, 0.16, 0.29),
      maxWidth: 500,
    });
    page.drawText("A Storypop book", {
      x: 56,
      y: 50,
      size: 12,
      font: body,
      color: rgb(0.16, 0.16, 0.29),
    });
  }

  // ─── Dedication ─────────────────────────────────────────────────────
  {
    const page = pdf.addPage([SIZE, SIZE]);
    page.drawText(sanitizeForPdf(`For ${input.childName}`), {
      x: 56,
      y: SIZE - 200,
      size: 28,
      font: display,
      color: rgb(0.16, 0.16, 0.29),
    });
    if (input.dedication) {
      page.drawText(sanitizeForPdf(input.dedication), {
        x: 56,
        y: SIZE - 260,
        size: 14,
        font: body,
        color: rgb(0.16, 0.16, 0.29),
        maxWidth: 500,
        lineHeight: 22,
      });
    }
  }

  // ─── Story pages ────────────────────────────────────────────────────
  for (let i = 0; i < input.pages.length; i++) {
    const page = pdf.addPage([SIZE, SIZE]);
    const key = input.pageR2Keys[i];
    if (key) {
      try {
        const img = await embedImage(pdf, key);
        page.drawImage(img, { x: 36, y: 200, width: 540, height: 380 });
      } catch (err) {
        // Bad image on a single page is non-fatal — the page still has its
        // text. The caller logs the error elsewhere via its retry loop.
        console.warn(`pdf-builder: skipping image on page ${i + 1}:`, err);
      }
    }
    page.drawText(sanitizeForPdf(input.pages[i].body), {
      x: 56,
      y: 140,
      size: 16,
      font: body,
      color: rgb(0.16, 0.16, 0.29),
      maxWidth: 500,
      lineHeight: 22,
    });
    page.drawText(String(i + 1), {
      x: SIZE - 56,
      y: 30,
      size: 10,
      font: body,
      color: rgb(0.5, 0.5, 0.6),
    });
  }

  // ─── Back cover ─────────────────────────────────────────────────────
  {
    const page = pdf.addPage([SIZE, SIZE]);
    page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: rgb(1, 0.42, 0.62) });
    page.drawText("The End", {
      x: 220,
      y: SIZE / 2,
      size: 36,
      font: display,
      color: rgb(1, 1, 1),
    });
    page.drawText("storypop.shop", {
      x: 240,
      y: 50,
      size: 12,
      font: body,
      color: rgb(1, 1, 1),
    });
  }

  const bytes = await pdf.save();
  const r2Key = `books/${input.bookId}/final.pdf`;
  await uploadToR2(r2Key, Buffer.from(bytes), "application/pdf");
  return { r2Key, byteLength: bytes.length };
}
