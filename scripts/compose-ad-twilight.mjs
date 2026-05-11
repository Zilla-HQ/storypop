import sharp from "sharp";
import fs from "fs";

const SIZE = 1080;
const HALF = SIZE / 2;

// Load + resize both photos to 540x1080 (cover, center crop)
const before = await sharp("/tmp/before.jpg").resize(HALF, SIZE, { fit: "cover", position: "center" }).toBuffer();
const after = await sharp("/tmp/after.jpg").resize(HALF, SIZE, { fit: "cover", position: "center" }).toBuffer();

// Build SVG overlay with labels + bottom banner
const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <!-- BEFORE label (top-left) -->
  <rect x="32" y="32" rx="22" ry="22" width="180" height="44" fill="rgba(0,0,0,0.75)"/>
  <text x="122" y="62" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle" letter-spacing="2">BEFORE</text>

  <!-- AFTER label (top-right) -->
  <rect x="${SIZE - 212}" y="32" rx="22" ry="22" width="180" height="44" fill="#10b981"/>
  <text x="${SIZE - 122}" y="62" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle" letter-spacing="2">AFTER</text>

  <!-- Center divider line -->
  <line x1="${HALF}" y1="0" x2="${HALF}" y2="${SIZE}" stroke="white" stroke-width="3"/>

  <!-- Bottom CTA banner -->
  <rect x="0" y="${SIZE - 180}" width="${SIZE}" height="180" fill="rgba(0,0,0,0.85)"/>
  <text x="${HALF}" y="${SIZE - 110}" fill="white" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="48" font-weight="800" text-anchor="middle">AI photo upgrade</text>
  <text x="${HALF}" y="${SIZE - 60}" fill="#10b981" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="36" font-weight="700" text-anchor="middle">$19 per listing • 2-min turnaround</text>
  <text x="${HALF}" y="${SIZE - 22}" fill="#94a3b8" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="22" font-weight="500" text-anchor="middle">realscale.app</text>
</svg>`;

// Composite: blank canvas → before (left) → after (right) → SVG overlay
await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0, g: 0, b: 0 } } })
  .composite([
    { input: before, left: 0, top: 0 },
    { input: after, left: HALF, top: 0 },
    { input: Buffer.from(svg), left: 0, top: 0 },
  ])
  .jpeg({ quality: 92 })
  .toFile("/Users/jack.lipstone/Desktop/realscale-ad-twilight.jpg");

console.log("Saved: ~/Desktop/realscale-ad-twilight.jpg");
console.log("Size:", fs.statSync("/Users/jack.lipstone/Desktop/realscale-ad-twilight.jpg").size, "bytes");
