/**
 * Variant: same before/after but with a scroll-stopping headline overlay.
 * Reddit users skip clean product imagery; text overlays read as editorial.
 *
 * Run:
 *   node scripts/build-ad-image-v2.mjs
 *   → writes /tmp/restay-reddit-ad-v2.jpg + ~/Desktop/restay-reddit-ad-v2.jpg
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";

const BEFORE_URL =
  "https://a0.muscache.com/im/pictures/hosting/Hosting-1589528284204431934/original/3558797c-9b07-4551-a4d0-1b1f24298494.png";
const AFTER_URL =
  "https://v3b.fal.media/files/b/0a983f2d/irCWR2X-k8QgpxsLQPiRq_3af32b06ea8d49a9913c73558b389052.jpg";

const W = 1200;
const H = 800;
const HEADER = 140; // top header band height
const PHOTO_H = H - HEADER;
const PANEL_W = W / 2;

async function dl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("downloading before + after...");
  const [beforeBuf, afterBuf] = await Promise.all([dl(BEFORE_URL), dl(AFTER_URL)]);

  console.log("resizing each to 600×660 (cover)...");
  const before = await sharp(beforeBuf)
    .resize(PANEL_W, PHOTO_H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();
  const after = await sharp(afterBuf)
    .resize(PANEL_W, PHOTO_H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  const svgOverlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .hook { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; font-weight: 800; font-size: 38px; fill: #ffffff; }
          .sub { font-family: -apple-system, system-ui, sans-serif; font-weight: 500; font-size: 18px; fill: #c7d2da; }
          .label { font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.12em; }
        </style>
      </defs>
      <!-- Top header dark band -->
      <rect x="0" y="0" width="${W}" height="${HEADER}" fill="#0f172a"/>
      <text x="${W / 2}" y="58" class="hook" text-anchor="middle">Most Airbnb listings haven't been updated in 14 months</text>
      <text x="${W / 2}" y="98" class="sub" text-anchor="middle">Free 60-second audit · paste your URL · see what comparable hosts are doing differently</text>
      <!-- BEFORE pill -->
      <rect x="32" y="${HEADER + 24}" rx="20" ry="20" width="120" height="40" fill="rgba(15,23,42,0.85)"/>
      <text x="92" y="${HEADER + 50}" class="label" fill="#ffffff" text-anchor="middle">BEFORE</text>
      <!-- AFTER pill -->
      <rect x="${PANEL_W + 32}" y="${HEADER + 24}" rx="20" ry="20" width="110" height="40" fill="rgba(4,120,87,0.95)"/>
      <text x="${PANEL_W + 87}" y="${HEADER + 50}" class="label" fill="#ffffff" text-anchor="middle">AFTER</text>
      <!-- divider -->
      <rect x="${PANEL_W - 1}" y="${HEADER}" width="2" height="${PHOTO_H}" fill="#ffffff"/>
    </svg>
  `);

  console.log("compositing...");
  const composite = await sharp({
    create: { width: W, height: H, channels: 3, background: "#0f172a" },
  })
    .composite([
      { input: before, left: 0, top: HEADER },
      { input: after, left: PANEL_W, top: HEADER },
      { input: svgOverlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  await fs.writeFile("/tmp/restay-reddit-ad-v2.jpg", composite);
  await fs.writeFile(`${homedir()}/Desktop/restay-reddit-ad-v2.jpg`, composite);
  console.log(`✓ wrote /tmp/restay-reddit-ad-v2.jpg (${composite.length} bytes, ${W}×${H})`);
  console.log(`✓ also: ~/Desktop/restay-reddit-ad-v2.jpg`);
}

main().catch((e) => { console.error(e); process.exit(1); });
