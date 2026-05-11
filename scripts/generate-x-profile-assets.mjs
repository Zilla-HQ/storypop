#!/usr/bin/env node
/**
 * Generate X profile picture (400×400) and banner (1500×500) for
 * @Sitebeatapp. Saves to ~/Desktop.
 *
 *   node scripts/generate-x-profile-assets.mjs
 *
 * X profile pictures are square; max 400×400 displayed, 2MB file size.
 * Banners are 1500×500 displayed, max 5MB. Both PNG.
 */

import sharp from "sharp";
import path from "node:path";
import os from "node:os";

const DESKTOP = path.join(os.homedir(), "Desktop");

// Profile picture: emerald square, white "S" with a subtle pulse dot.
const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="80" fill="url(#bg)"/>
  <text x="200" y="290" font-family="-apple-system, system-ui, sans-serif"
        font-size="280" font-weight="900" text-anchor="middle"
        fill="white" letter-spacing="-8">S</text>
  <circle cx="310" cy="100" r="22" fill="#10b981" stroke="white" stroke-width="8"/>
</svg>`;

// Banner: 1500×500. Left: brand mark + tagline. Right: row of 13 emerald
// check-mark "pulse" indicators evoking the 13 checks per audit.
const BANNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="50%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#065f46"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1500" height="500" fill="url(#bg)"/>
  <circle cx="1200" cy="250" r="350" fill="url(#glow)"/>

  <!-- Brand mark + name -->
  <g transform="translate(80, 180)">
    <rect x="0" y="0" width="100" height="100" rx="22" fill="white"/>
    <text x="50" y="78" font-family="-apple-system, system-ui, sans-serif"
          font-size="74" font-weight="900" text-anchor="middle"
          fill="#047857" letter-spacing="-2">S</text>
  </g>

  <text x="220" y="220" font-family="-apple-system, system-ui, sans-serif"
        font-size="72" font-weight="800" fill="white" letter-spacing="-1">
    Sitebeat
  </text>
  <text x="222" y="270" font-family="-apple-system, system-ui, sans-serif"
        font-size="26" font-weight="500" fill="white" opacity="0.85"
        letter-spacing="0.5">
    Smoke detector for your SEO
  </text>

  <!-- 13 pulse-check indicators on the right -->
  <g transform="translate(880, 220)">
    ${Array.from({ length: 13 })
      .map((_, i) => {
        const x = i * 38;
        const opacity = 0.4 + (i / 13) * 0.6;
        return `<g transform="translate(${x}, 0)">
          <circle cx="14" cy="14" r="14" fill="white" opacity="${opacity}"/>
          <path d="M 8 14 L 12 18 L 20 10" stroke="#047857" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`;
      })
      .join("\n    ")}
  </g>
  <text x="880" y="195" font-family="-apple-system, system-ui, sans-serif"
        font-size="18" font-weight="700" fill="white" opacity="0.9"
        letter-spacing="3" text-transform="uppercase">
    13 SEO CHECKS · WEEKLY · $29/MO
  </text>
</svg>`;

async function main() {
  const avatarPath = path.join(DESKTOP, "sitebeat-x-avatar.png");
  const bannerPath = path.join(DESKTOP, "sitebeat-x-banner.png");

  await sharp(Buffer.from(AVATAR_SVG))
    .resize(400, 400)
    .png()
    .toFile(avatarPath);
  console.log(`✓ ${avatarPath} (400×400)`);

  await sharp(Buffer.from(BANNER_SVG))
    .resize(1500, 500)
    .png()
    .toFile(bannerPath);
  console.log(`✓ ${bannerPath} (1500×500)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
