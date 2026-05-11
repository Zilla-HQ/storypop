import sharp from "sharp";
import fs from "fs";

const VARIANT = process.argv[2] || "staging";
const RATIO = process.argv[3] || "1x1"; // 1x1 | 9x16 | 1.91x1

// Pick canvas + photo block size per Meta placement
let CANVAS_W, CANVAS_H, PHOTO_W, PHOTO_H, LAYOUT;
if (RATIO === "1x1") {
  // Square (feed): 1080x1080, stacked top/bottom
  CANVAS_W = 1080; CANVAS_H = 1080;
  PHOTO_W = 1080; PHOTO_H = 540;
  LAYOUT = "stacked";
} else if (RATIO === "9x16") {
  // Vertical (Stories/Reels): 1080x1920, stacked top/bottom with bigger photo halves
  CANVAS_W = 1080; CANVAS_H = 1920;
  PHOTO_W = 1080; PHOTO_H = 960;
  LAYOUT = "stacked";
} else if (RATIO === "1.91x1") {
  // Horizontal (right column / marketplace): 1200x628, side-by-side
  CANVAS_W = 1200; CANVAS_H = 628;
  PHOTO_W = 600; PHOTO_H = 628;
  LAYOUT = "side";
} else {
  throw new Error(`Unknown ratio: ${RATIO}`);
}

const OUT = `/Users/jack.lipstone/Desktop/realscale-ad-${VARIANT}-${RATIO}.jpg`;

const before = await sharp("/tmp/before.jpg").resize(PHOTO_W, PHOTO_H, { fit: "cover", position: "center" }).toBuffer();
const after = await sharp("/tmp/after.jpg").resize(PHOTO_W, PHOTO_H, { fit: "cover", position: "center" }).toBuffer();

// Position pills + dividers based on layout
let svg;
if (LAYOUT === "stacked") {
  svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="32" y="32" rx="22" ry="22" width="160" height="44" fill="rgba(0,0,0,0.78)"/>
    <text x="112" y="62" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle" letter-spacing="2">BEFORE</text>

    <rect x="32" y="${PHOTO_H + 32}" rx="22" ry="22" width="140" height="44" fill="#10b981"/>
    <text x="102" y="${PHOTO_H + 62}" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle" letter-spacing="2">AFTER</text>

    <line x1="0" y1="${PHOTO_H}" x2="${CANVAS_W}" y2="${PHOTO_H}" stroke="white" stroke-width="4"/>
  </svg>`;
} else {
  // side-by-side
  svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="24" y="24" rx="20" ry="20" width="140" height="40" fill="rgba(0,0,0,0.78)"/>
    <text x="94" y="51" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="18" font-weight="700" text-anchor="middle" letter-spacing="2">BEFORE</text>

    <rect x="${CANVAS_W - 164}" y="24" rx="20" ry="20" width="140" height="40" fill="#10b981"/>
    <text x="${CANVAS_W - 94}" y="51" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="18" font-weight="700" text-anchor="middle" letter-spacing="2">AFTER</text>

    <line x1="${PHOTO_W}" y1="0" x2="${PHOTO_W}" y2="${CANVAS_H}" stroke="white" stroke-width="4"/>
  </svg>`;
}

const composites = LAYOUT === "stacked"
  ? [
      { input: before, left: 0, top: 0 },
      { input: after, left: 0, top: PHOTO_H },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ]
  : [
      { input: before, left: 0, top: 0 },
      { input: after, left: PHOTO_W, top: 0 },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ];

await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: { r: 0, g: 0, b: 0 } } })
  .composite(composites)
  .jpeg({ quality: 92 })
  .toFile(OUT);

console.log("Saved:", OUT, fs.statSync(OUT).size, "bytes");
