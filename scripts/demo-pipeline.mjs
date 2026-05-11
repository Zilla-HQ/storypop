/**
 * End-to-end pipeline demo using existing scraped Apify data.
 * Shows real outputs from fal.ai photo edit + Claude copy rewrite + Claude
 * outreach email — proving the pipeline produces value before unlocking
 * more Apify quota.
 *
 * Run:
 *   node --env-file=.env.local scripts/demo-pipeline.mjs
 */
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import postgres from "postgres";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const FAL_API_KEY = process.env.FAL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APIFY_RUN_ID = "abKasfHQeOgV84DUL"; // an earlier successful run

if (!APIFY_TOKEN || !FAL_API_KEY || !ANTHROPIC_API_KEY) {
  throw new Error("Missing API keys");
}

fal.config({ credentials: FAL_API_KEY });
const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const log = (...a) => console.log(...a);
const hr = () => log("─".repeat(70));

async function main() {
  // 1. Fetch the listing from the earlier successful Apify run
  log("STEP 1: Fetching scraped listing from Apify run", APIFY_RUN_ID);
  const dsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${APIFY_RUN_ID}/dataset/items?token=${encodeURIComponent(APIFY_TOKEN)}&limit=1`
  );
  const items = await dsRes.json();
  const item = items[0];
  if (!item) throw new Error("No items in dataset");

  const title = item.title || item.seoTitle || item.sharingConfigTitle;
  const desc = item.description || item.metaDescription || item.subDescription || "";
  const photos = (item.images || []).map((p) => p.imageUrl).filter(Boolean);
  const city = item.location;
  const stateName = (item.locationSubtitle || "").split(",")[1]?.trim();
  const host = item.host?.name;
  const rating = item.rating?.guestSatisfaction;
  const reviews = item.rating?.reviewsCount;
  const isSuper = item.host?.isSuperHost;
  const url = item.url?.split("?")[0];

  // Extract per-night rate from the breakdown
  const nightlyMatch = (item.price?.breakDown?.basePrice?.description || "").match(/\$([\d,]+(?:\.\d+)?)/);
  const nightly = nightlyMatch ? Number(nightlyMatch[1].replace(/,/g, "")) : null;

  hr();
  log("LISTING SCRAPED");
  hr();
  log("Title:    ", title);
  log("Location: ", city, stateName);
  log("URL:      ", url);
  log("Host:     ", host, isSuper ? "(Superhost)" : "");
  log("Reviews:  ", reviews, "@", rating, "⭐");
  log("Nightly:  ", nightly ? `$${nightly}/night` : "(unknown)");
  log("Photos:   ", photos.length);
  log("Desc len: ", desc.length, "chars");
  log();

  // 2. Run fal.ai photo edit on the first photo
  log("STEP 2: Sending first photo to fal.ai Flux Kontext for edit-only restyle...");
  const editPrompt = [
    "Edit this exact photograph of a living room to improve its appeal as an Airbnb listing photo.",
    "Edit this Airbnb listing photo to maximize booking appeal:",
    "declutter visible clutter and minor distractions (cables, remotes, half-empty drink containers, unfolded throws),",
    "brighten and warm the interior lighting, professionally color-grade for inviting tones,",
    "replace any visible sky with a soft golden-hour gradient if windows show outdoors,",
    "sharpen architectural features.",
    "Warm modern color grading, soft lifted highlights, natural daylight, gentle declutter.",
    "STRICT: do not add or remove furniture or fixtures. Keep the exact same camera angle,",
    "walls, ceiling, floor, windows, doors, and architectural features identical to the source.",
    "Do not change the room type, layout, or perspective. The photo must continue to accurately",
    "represent the actual space (Airbnb policy compliant).",
    "Photo-realistic interior architectural photography. No text, no watermarks, no logos.",
  ].join(" ");

  const sourcePhoto = photos[0];
  log("  source:", sourcePhoto.slice(0, 80) + "...");
  const falStart = Date.now();
  let editedUrl;
  try {
    const result = await fal.subscribe(
      process.env.FAL_PREVIEW_MODEL ?? "fal-ai/flux-pro/kontext",
      {
        input: {
          prompt: editPrompt,
          image_url: sourcePhoto,
          guidance_scale: 3.5,
          num_images: 1,
          output_format: "jpeg",
        },
        logs: false,
      }
    );
    editedUrl = result?.data?.images?.[0]?.url;
    log(`  ✓ edited in ${((Date.now() - falStart) / 1000).toFixed(1)}s`);
  } catch (e) {
    log("  ✗ fal.ai failed:", e.message);
  }

  hr();
  log("PHOTO EDIT");
  hr();
  log("BEFORE:  ", sourcePhoto);
  log("AFTER:   ", editedUrl ?? "(failed)");
  log();

  // 3. Run Claude copy rewriter
  log("STEP 3: Sending listing copy to Claude Haiku for rewrite...");
  const rewriteSystem = `You are a senior Airbnb listing copywriter. You rewrite host-written titles and descriptions to maximize booking conversion on Airbnb's search and detail pages.

Constraints:
- Title: max 50 characters. Lead with the strongest amenity OR the strongest experience differentiator. No emojis.
- Description: 3 short paragraphs in this order — Hook (one sensory detail), Proof (concrete amenities, walkability, bed setup), Call (logistics, why-now). Total 120-180 words.
- Tone: warm, confident, specific. Never salesy. Never claim guaranteed booking lift (FTC).
- Stay 100% factual to the original — never invent amenities or location features.

Return ONLY JSON: { "title": "...", "description": "..." }`;

  const rewriteUser = `Original title: ${title}

Original description:
${desc}

Location: ${city}, ${stateName}
Sleeps: ${item.personCapacity}`;

  const rewriteResp = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    system: rewriteSystem,
    messages: [{ role: "user", content: rewriteUser }],
  });
  const rewriteRaw = rewriteResp.content[0]?.type === "text" ? rewriteResp.content[0].text : "";
  let rewritten = null;
  try { rewritten = JSON.parse(stripFences(rewriteRaw)); } catch (e) { log("  parse err:", e.message); log("  raw:", rewriteRaw.slice(0, 200)); }

  hr();
  log("COPY REWRITE");
  hr();
  log("ORIGINAL TITLE:   ", title);
  log("ORIGINAL DESC:    ", desc.slice(0, 150) + (desc.length > 150 ? "..." : ""));
  log();
  log("REWRITTEN TITLE:  ", rewritten?.title ?? "(parse failed)");
  log("REWRITTEN DESC:   ", rewritten?.description ?? "(parse failed)");
  log();

  // 4. Run Claude email drafter
  log("STEP 4: Drafting cold-outreach email with Claude...");
  const emailSystem = `You are a conversion copywriter for Restay, a one-time Airbnb listing optimization service ($79 = rewritten copy + 10 restyled photos + 30-day pricing report).

Audience: Airbnb hosts whose listings are public but obviously un-optimized.

Tone: peer-to-peer, specific, observational. NEVER salesy. Under 110 words.
Never promise booking-rate lift in numbers (FTC). Never say "AI" — describe as "our audit pipeline" or "our editor".

Structure:
1. One-line hook tying to a SPECIFIC observation about their listing (mention the address)
2. Three bullets — concrete audit findings (a copy issue, a photo issue, a pricing observation)
3. One soft CTA describing the $79 deliverable
4. The {{CTA}} placeholder on its own line

Return ONLY a JSON object: {"subject": "...", "bodyText": "..."}

Subject MUST be: "{shortAddress} — your free 60-second Airbnb audit"

DO NOT include the checkout URL in your bodyText — we append it programmatically.`;

  const emailUser = `Host first name: ${host?.split(" ")[0] ?? "there"}
Address (shortened): ${city}, ${stateName}
Listing photo count: ${photos.length}
Current title: "${title}"
Reviews: ${reviews} (avg ${rating?.toFixed(2)})
Tune-Up price: $79`;

  const emailResp = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    system: emailSystem,
    messages: [{ role: "user", content: emailUser }],
  });
  const emailRaw = emailResp.content[0]?.type === "text" ? emailResp.content[0].text : "";
  let email = null;
  try { email = JSON.parse(stripFences(emailRaw)); } catch (e) { log("  parse err:", e.message); log("  raw:", emailRaw.slice(0, 200)); }

  hr();
  log("COLD-OUTREACH EMAIL DRAFT");
  hr();
  log("SUBJECT: ", email?.subject ?? "(parse failed)");
  log();
  log(email?.bodyText ?? "(parse failed)");
  log();
  log("[checkoutLink would go here — restay.agency/l/<slug>]");
  log();
  log("— Restay");
  log();

  hr();
  log("DEMO COMPLETE");
  hr();
  log("This was the FULL pipeline minus the cold-outreach send + Stripe checkout.");
  log("Every URL above is real, generated by the same code that runs in production.");
  log("Open BEFORE/AFTER URLs in browser to compare.");
}

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
}

main().catch((e) => { console.error(e); process.exit(1); });
