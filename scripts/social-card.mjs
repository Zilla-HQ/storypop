// Generate a sample social-card image locally without deploying.
// Useful for previewing what the daily Pinterest poster will produce.
//
// Usage:
//   node scripts/social-card.mjs                # picks the most recent
//                                                  homeowner-side preview
//   node scripts/social-card.mjs <previewId>    # specific preview
//
// Output: /tmp/social-card-<previewId>.jpg

import postgres from "postgres";
import sharp from "sharp";
import { writeFileSync } from "node:fs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing — `set -a; source .env.local; set +a` first");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const explicit = process.argv[2];

const rows = explicit
  ? await sql`
      SELECT p.id as preview_id, p.service_id, p.original_photo_urls, p.enhanced_photo_urls,
             l.city, l.state
      FROM relist.previews p JOIN relist.listings l ON l.id = p.listing_id
      WHERE p.id = ${explicit}
      LIMIT 1`
  : await sql`
      SELECT p.id as preview_id, p.service_id, p.original_photo_urls, p.enhanced_photo_urls,
             l.city, l.state
      FROM relist.previews p JOIN relist.listings l ON l.id = p.listing_id
      WHERE p.service_id IN ('pool-mockup','solar-mockup','curb-appeal')
        AND jsonb_array_length(p.original_photo_urls) > 0
        AND jsonb_array_length(p.enhanced_photo_urls) > 0
      ORDER BY p.created_at DESC
      LIMIT 1`;

if (rows.length === 0) {
  console.error("No matching preview found");
  await sql.end();
  process.exit(2);
}

const r = rows[0];
const cityLabel = r.city && r.state ? `${r.city}, ${r.state}` : "your home";
console.log(`Building card from preview ${r.preview_id} (${r.service_id}) — ${cityLabel}`);

const W = 1080, H = 1920, halfH = Math.floor((H - 200) / 2);

async function fetchAndResize(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url.slice(0, 80)}...`);
  return sharp(Buffer.from(await res.arrayBuffer()))
    .resize(W, halfH, { fit: "cover", position: "center" })
    .jpeg({ quality: 90 })
    .toBuffer();
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const [before, after] = await Promise.all([
  fetchAndResize(r.original_photo_urls[0]),
  fetchAndResize(r.enhanced_photo_urls[0]),
]);

const brand = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="200">
  <rect width="${W}" height="200" fill="#0f172a"/>
  <text x="${W / 2}" y="58" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="32" font-weight="700" fill="#10b981">REALSCALE</text>
  <text x="${W / 2}" y="115" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="48" font-weight="700" fill="white">${esc(cityLabel)}</text>
  <text x="${W / 2}" y="165" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="500" fill="#94a3b8">Free at realscale.app</text>
</svg>`;
const lbl = (text, x, y) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${x}" y="${y}" width="160" height="48" rx="6" fill="black" fill-opacity="0.7"/>
    <text x="${x + 16}" y="${y + 32}" font-family="Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="white">${text}</text>
  </svg>`;

const buf = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 15, g: 23, b: 42 } },
})
  .composite([
    { input: before, top: 0, left: 0 },
    { input: after, top: halfH, left: 0 },
    { input: Buffer.from(lbl("BEFORE", 24, 24)), top: 0, left: 0 },
    { input: Buffer.from(lbl("AFTER", 24, halfH + 24)), top: 0, left: 0 },
    { input: Buffer.from(brand), top: H - 200, left: 0 },
  ])
  .jpeg({ quality: 90 })
  .toBuffer();

const outPath = `/tmp/social-card-${r.preview_id}.jpg`;
writeFileSync(outPath, buf);
console.log(`✓ wrote ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
console.log(`  Open: open ${outPath}`);

await sql.end();
