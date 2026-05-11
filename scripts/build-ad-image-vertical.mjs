/**
 * 9:16 vertical for Instagram Stories / Reels / Facebook Stories.
 * 1080×1920 with:
 *   - 80px top safe zone (Meta's "Sponsored" label area)
 *   - 260px hook text band
 *   - 720px BEFORE photo + label
 *   - 4px white divider
 *   - 720px AFTER photo + label
 *   - 136px bottom safe zone (CTA + Meta UI)
 *
 * Run:
 *   node scripts/build-ad-image-vertical.mjs
 *   → ~/Desktop/restay-meta-vertical.jpg (1080×1920)
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

async function main() {
  console.log("downloading source photos...");
  const [beforeBuf, afterBuf] = await Promise.all([dl(BEFORE_URL), dl(AFTER_URL)]);

  const W = 1080;
  const H = 1920;
  const TOP_SAFE = 80;
  const HOOK_H = 260;
  const PHOTO_H = 720;
  const DIVIDER = 4;
  // Layout: TOP_SAFE + HOOK_H + PHOTO_H + DIVIDER + PHOTO_H = 80+260+720+4+720 = 1784
  // Bottom safe: 1920 - 1784 = 136
  const BEFORE_TOP = TOP_SAFE + HOOK_H;
  const AFTER_TOP = BEFORE_TOP + PHOTO_H + DIVIDER;

  console.log("resizing photos to 1080×720 (cover)...");
  const before = await sharp(beforeBuf)
    .resize(W, PHOTO_H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();
  const after = await sharp(afterBuf)
    .resize(W, PHOTO_H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  console.log("building overlay...");
  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .hook { font-family: -apple-system, system-ui, sans-serif; font-weight: 800; font-size: 56px; fill: #ffffff; }
        .sub { font-family: -apple-system, system-ui, sans-serif; font-weight: 500; font-size: 26px; fill: #c7d2da; }
        .label { font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 24px; letter-spacing: 0.12em; }
        .footer { font-family: -apple-system, system-ui, sans-serif; font-weight: 600; font-size: 22px; fill: #c7d2da; letter-spacing: 0.06em; }
      </style>

      <!-- Hook band -->
      <text x="${W / 2}" y="${TOP_SAFE + 70}" class="hook" text-anchor="middle">Most Airbnb listings</text>
      <text x="${W / 2}" y="${TOP_SAFE + 130}" class="hook" text-anchor="middle">haven't been updated</text>
      <text x="${W / 2}" y="${TOP_SAFE + 190}" class="hook" text-anchor="middle">in 14 months.</text>
      <text x="${W / 2}" y="${TOP_SAFE + 232}" class="sub" text-anchor="middle">Free 60-second audit · paste your URL</text>

      <!-- BEFORE pill (top-left of upper photo) -->
      <rect x="36" y="${BEFORE_TOP + 28}" rx="22" ry="22" width="140" height="44" fill="rgba(15,23,42,0.88)"/>
      <text x="106" y="${BEFORE_TOP + 58}" class="label" fill="#ffffff" text-anchor="middle">BEFORE</text>

      <!-- AFTER pill (top-left of lower photo) -->
      <rect x="36" y="${AFTER_TOP + 28}" rx="22" ry="22" width="128" height="44" fill="rgba(4,120,87,0.95)"/>
      <text x="100" y="${AFTER_TOP + 58}" class="label" fill="#ffffff" text-anchor="middle">AFTER</text>

      <!-- Bottom brand mark / footer text (in the bottom safe zone) -->
      <text x="${W / 2}" y="${H - 64}" class="footer" text-anchor="middle">RESTAY · listing tune-up · $79</text>
    </svg>
  `);

  console.log("compositing...");
  const composite = await sharp({
    create: { width: W, height: H, channels: 3, background: "#0f172a" },
  })
    .composite([
      { input: before, left: 0, top: BEFORE_TOP },
      { input: after, left: 0, top: AFTER_TOP },
      // White divider between photos
      {
        input: {
          create: { width: W, height: DIVIDER, channels: 3, background: "#ffffff" },
        },
        left: 0,
        top: BEFORE_TOP + PHOTO_H,
      },
      { input: svg, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  const out = `${homedir()}/Desktop/restay-meta-vertical.jpg`;
  await fs.writeFile(out, composite);
  console.log(`✓ wrote ${out} (${composite.length} bytes, ${W}×${H})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
