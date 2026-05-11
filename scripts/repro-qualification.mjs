/**
 * Reproduce the qualification agent body locally against the DB.
 * Surfaces the actual error text that Inngest is showing 100% failure for.
 */
import postgres from "postgres";
import OpenAI from "openai";

const db = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 15 });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scorePhotoQuality(imageUrl) {
  const PROMPT = `You are rating an MLS real estate listing photo on quality (1-5).
Return ONLY a JSON object: {"score": <1-5>, "reason": "<one-line reason>"}.`;
  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: imageUrl } }] }],
  });
  const raw = resp.choices[0]?.message?.content ?? '{"score":3,"reason":"parse error"}';
  return JSON.parse(raw);
}

try {
  // Pick the most recent seeded listing
  // Prefer a listing that actually has photos to exercise vision scoring.
  const [listing] = await db`
    SELECT * FROM relist.listings
    WHERE jsonb_array_length(photos::jsonb) > 0
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!listing) throw new Error("No listings to test");
  console.log(`Testing on: ${listing.id} (${listing.address})`);
  console.log(`Photos: ${listing.photos.length}`);

  const sampled = listing.photos.slice(0, 3);
  console.log(`\nSampling ${sampled.length} photos...`);

  const scores = [];
  for (const [i, url] of sampled.entries()) {
    console.log(`  [${i + 1}/${sampled.length}] ${url.slice(0, 60)}...`);
    try {
      const s = await scorePhotoQuality(url);
      console.log(`    → score=${s.score} reason="${s.reason}"`);
      scores.push(s);
    } catch (e) {
      console.error(`    ✗ ERROR: ${e.message}`);
      if (e.status) console.error(`      status=${e.status}`);
      if (e.code) console.error(`      code=${e.code}`);
      throw e;
    }
  }

  console.log("\n✓ Vision scoring works");

  // Now try the DB update
  console.log("\nTesting DB update...");
  const avg = scores.reduce((s, p) => s + p.score, 0) / scores.length;
  await db`
    UPDATE relist.listings SET
      photo_score = ${avg},
      qualified = true,
      qualification_reason = 'smoke test'
    WHERE id = ${listing.id}
  `;
  console.log("✓ DB update works");
  console.log(`\nSUCCESS — qualification body works locally. The Inngest-side failure must be env-related.`);
} catch (e) {
  console.error(`\nREPRO of qualification failure:`);
  console.error(`  ${e.constructor.name}: ${e.message}`);
  if (e.stack) console.error(e.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
} finally {
  await db.end();
}
