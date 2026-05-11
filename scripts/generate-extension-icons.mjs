#!/usr/bin/env node
/**
 * Generate Chrome extension icons (16/48/128 px PNG) from an SVG.
 * Uses sharp (already a project dep). Run once before submitting the
 * extension; outputs are committed.
 *
 *   node scripts/generate-extension-icons.mjs
 */

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "extension", "icons");

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#059669"/>
  <text x="64" y="92" font-family="-apple-system, system-ui, sans-serif"
        font-size="84" font-weight="800" text-anchor="middle"
        fill="white" letter-spacing="-2">S</text>
  <circle cx="98" cy="34" r="8" fill="#10b981" stroke="white" stroke-width="3"/>
</svg>`;

const SIZES = [16, 48, 128];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const buffer = Buffer.from(SVG);
  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(buffer)
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`✓ ${out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
