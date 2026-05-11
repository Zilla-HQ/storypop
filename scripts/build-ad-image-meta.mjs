/**
 * Meta-spec ad image variants — both 1080×1080 (square, universal) and
 * 1200×628 (landscape, Facebook Feed optimized). Same source photos as Reddit
 * v2; layout adjusted per aspect ratio.
 *
 * Run:
 *   node scripts/build-ad-image-meta.mjs
 *   → writes ~/Desktop/restay-meta-square.jpg (1080×1080)
 *   → writes ~/Desktop/restay-meta-landscape.jpg (1200×628)
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";

const BEFORE_URL =
  "https://a0.muscache.com/im/pictures/hosting/Hosting-1589528284204431934/original/3558797c-9b07-4551-a4d0-1b1f24298494.png";
const AFTER_URL =
  "https://v3b.fal.media/files/b/0a983f2d/irCWR2X-k8QgpxsLQPiRq_3af32b06ea8d49a9913c73558b389052.jpg";

async function dl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── 1080×1080 square — stacked BEFORE/AFTER + headline band ──────────────
async function buildSquare(beforeBuf, afterBuf) {
  const W = 1080;
  const H = 1080;
  const HEADER = 180;
  const PHOTO_H = (H - HEADER - 4) / 2; // -4 for divider

  const before = await sharp(beforeBuf)
    .resize(W, Math.round(PHOTO_H), { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();
  const after = await sharp(afterBuf)
    .resize(W, Math.round(PHOTO_H), { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .hook { font-family: -apple-system, system-ui, sans-serif; font-weight: 800; font-size: 42px; fill: #ffffff; }
        .sub { font-family: -apple-system, system-ui, sans-serif; font-weight: 500; font-size: 22px; fill: #c7d2da; }
        .label { font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 20px; letter-spacing: 0.12em; }
      </style>
      <!-- Header dark band -->
      <rect x="0" y="0" width="${W}" height="${HEADER}" fill="#0f172a"/>
      <text x="${W / 2}" y="78" class="hook" text-anchor="middle">Most Airbnb listings haven't been</text>
      <text x="${W / 2}" y="124" class="hook" text-anchor="middle">updated in 14 months.</text>
      <text x="${W / 2}" y="158" class="sub" text-anchor="middle">Free 60-second audit · paste your URL · see what's holding it back</text>
      <!-- BEFORE pill on left of upper photo -->
      <rect x="32" y="${HEADER + 24}" rx="20" ry="20" width="120" height="40" fill="rgba(15,23,42,0.85)"/>
      <text x="92" y="${HEADER + 50}" class="label" fill="#ffffff" text-anchor="middle">BEFORE</text>
      <!-- AFTER pill on left of lower photo -->
      <rect x="32" y="${HEADER + Math.round(PHOTO_H) + 28}" rx="20" ry="20" width="110" height="40" fill="rgba(4,120,87,0.95)"/>
      <text x="87" y="${HEADER + Math.round(PHOTO_H) + 54}" class="label" fill="#ffffff" text-anchor="middle">AFTER</text>
      <!-- horizontal divider between photos -->
      <rect x="0" y="${HEADER + Math.round(PHOTO_H)}" width="${W}" height="4" fill="#ffffff"/>
    </svg>
  `);

  return sharp({ create: { width: W, height: H, channels: 3, background: "#0f172a" } })
    .composite([
      { input: before, left: 0, top: HEADER },
      { input: after, left: 0, top: HEADER + Math.round(PHOTO_H) + 4 },
      { input: svg, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ─── 1200×628 landscape — side-by-side, compact header ────────────────────
async function buildLandscape(beforeBuf, afterBuf) {
  const W = 1200;
  const H = 628;
  const HEADER = 110;
  const PHOTO_H = H - HEADER;
  const PANEL_W = W / 2;

  const before = await sharp(beforeBuf)
    .resize(PANEL_W, PHOTO_H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();
  const after = await sharp(afterBuf)
    .resize(PANEL_W, PHOTO_H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .hook { font-family: -apple-system, system-ui, sans-serif; font-weight: 800; font-size: 30px; fill: #ffffff; }
        .sub { font-family: -apple-system, system-ui, sans-serif; font-weight: 500; font-size: 16px; fill: #c7d2da; }
        .label { font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.12em; }
      </style>
      <rect x="0" y="0" width="${W}" height="${HEADER}" fill="#0f172a"/>
      <text x="${W / 2}" y="50" class="hook" text-anchor="middle">Most Airbnb listings haven't been updated in 14 months</text>
      <text x="${W / 2}" y="84" class="sub" text-anchor="middle">Free 60-second audit · paste your URL · see what's holding it back</text>
      <!-- BEFORE pill -->
      <rect x="24" y="${HEADER + 18}" rx="18" ry="18" width="100" height="32" fill="rgba(15,23,42,0.85)"/>
      <text x="74" y="${HEADER + 40}" class="label" fill="#ffffff" text-anchor="middle">BEFORE</text>
      <!-- AFTER pill -->
      <rect x="${PANEL_W + 24}" y="${HEADER + 18}" rx="18" ry="18" width="92" height="32" fill="rgba(4,120,87,0.95)"/>
      <text x="${PANEL_W + 70}" y="${HEADER + 40}" class="label" fill="#ffffff" text-anchor="middle">AFTER</text>
      <!-- vertical divider -->
      <rect x="${PANEL_W - 1}" y="${HEADER}" width="2" height="${PHOTO_H}" fill="#ffffff"/>
    </svg>
  `);

  return sharp({ create: { width: W, height: H, channels: 3, background: "#0f172a" } })
    .composite([
      { input: before, left: 0, top: HEADER },
      { input: after, left: PANEL_W, top: HEADER },
      { input: svg, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function main() {
  console.log("downloading source photos...");
  const [beforeBuf, afterBuf] = await Promise.all([dl(BEFORE_URL), dl(AFTER_URL)]);

  console.log("building 1080×1080 square...");
  const square = await buildSquare(beforeBuf, afterBuf);
  await fs.writeFile(`${homedir()}/Desktop/restay-meta-square.jpg`, square);
  console.log(`  ✓ ~/Desktop/restay-meta-square.jpg (${square.length} bytes)`);

  console.log("building 1200×628 landscape...");
  const landscape = await buildLandscape(beforeBuf, afterBuf);
  await fs.writeFile(`${homedir()}/Desktop/restay-meta-landscape.jpg`, landscape);
  console.log(`  ✓ ~/Desktop/restay-meta-landscape.jpg (${landscape.length} bytes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
