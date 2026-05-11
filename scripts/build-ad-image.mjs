/**
 * Build a side-by-side before/after composite from a real fal.ai output,
 * sized for Reddit's recommended landscape ad image (1200×800).
 *
 * Run:
 *   node --env-file=.env.local scripts/build-ad-image.mjs
 *   → writes /tmp/restay-reddit-ad.jpg
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";

const BEFORE_URL =
  "https://a0.muscache.com/im/pictures/hosting/Hosting-1589528284204431934/original/3558797c-9b07-4551-a4d0-1b1f24298494.png";
const AFTER_URL =
  "https://v3b.fal.media/files/b/0a983f2d/irCWR2X-k8QgpxsLQPiRq_3af32b06ea8d49a9913c73558b389052.jpg";

const W = 1200;
const H = 800;
const PANEL_W = W / 2;

async function dl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("downloading before + after...");
  const [beforeBuf, afterBuf] = await Promise.all([dl(BEFORE_URL), dl(AFTER_URL)]);

  console.log("resizing each to 600×800 (cover)...");
  const before = await sharp(beforeBuf)
    .resize(PANEL_W, H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();
  const after = await sharp(afterBuf)
    .resize(PANEL_W, H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  // Build SVG label overlay
  const svgOverlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .label { font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.12em; }
        .pill { fill: rgba(15,23,42,0.85); }
        .pill-after { fill: rgba(4,120,87,0.95); }
      </style>
      <!-- BEFORE pill -->
      <rect x="32" y="32" rx="20" ry="20" width="120" height="40" class="pill"/>
      <text x="92" y="58" class="label" fill="#ffffff" text-anchor="middle">BEFORE</text>
      <!-- AFTER pill -->
      <rect x="${PANEL_W + 32}" y="32" rx="20" ry="20" width="110" height="40" class="pill-after"/>
      <text x="${PANEL_W + 87}" y="58" class="label" fill="#ffffff" text-anchor="middle">AFTER</text>
      <!-- divider line -->
      <rect x="${PANEL_W - 1}" y="0" width="2" height="${H}" fill="#ffffff"/>
    </svg>
  `);

  console.log("compositing...");
  const composite = await sharp({
    create: { width: W, height: H, channels: 3, background: "#000" },
  })
    .composite([
      { input: before, left: 0, top: 0 },
      { input: after, left: PANEL_W, top: 0 },
      { input: svgOverlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  const out = "/tmp/restay-reddit-ad.jpg";
  await fs.writeFile(out, composite);
  console.log(`✓ wrote ${out} (${composite.length} bytes, 1200×800)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
