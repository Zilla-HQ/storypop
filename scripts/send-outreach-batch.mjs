/**
 * Batch-send real outreach emails using existing Apify scrape data.
 * No new scraping. Routes everything to a single recipient (you) so you
 * can review before flipping to real hosts.
 *
 * Run:
 *   node --env-file=.env.local scripts/send-outreach-batch.mjs
 *   # or override recipient + count:
 *   RECIPIENT=jack@seifdn.org BATCH_SIZE=5 node --env-file=.env.local scripts/send-outreach-batch.mjs
 */
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import { Resend } from "resend";
import mjml2html from "mjml";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const FAL_API_KEY = process.env.FAL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RECIPIENT = process.env.RECIPIENT || "jack@seifdn.org";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 5);
const SENDER_DOMAIN = (process.env.SENDER_DOMAINS || "mail.restay.agency").split(",")[0];
const BUSINESS_NAME = process.env.BUSINESS_NAME || "Restay";
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || "3500 South Dupont Highway, Dover, DE 19901";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://restay.agency";

if (!APIFY_TOKEN || !FAL_API_KEY || !ANTHROPIC_API_KEY || !RESEND_API_KEY) {
  throw new Error("Missing API keys");
}

fal.config({ credentials: FAL_API_KEY });
const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const resend = new Resend(RESEND_API_KEY);

// Successful Apify runs from earlier today
const RUN_IDS = [
  "OqeXeVFShjP0MHx7U",
  "abKasfHQeOgV84DUL",
  "dFXAnTFU6rzPiavxE",
  "DWcMbXJEf17cpTNw2",
  "CeJZ7epKB9RzQ44e4",
  "Vg6yhggFWCp8FfID7",
  "fp0UfX3aDFSIXXclq",
];

const log = (...a) => console.log(...a);

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
}

async function fetchRunItems(runId) {
  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(APIFY_TOKEN)}`
  );
  if (!res.ok) return [];
  return res.json();
}

async function gatherListings(runIds, limit) {
  const seen = new Set();
  const out = [];
  for (const runId of runIds) {
    const items = await fetchRunItems(runId);
    for (const item of items) {
      const id = String(item.id || item.listingId || "");
      if (!id || seen.has(id)) continue;
      // Need a valid first image and decent metadata
      if (!item.images?.[0]?.imageUrl) continue;
      seen.add(id);
      out.push(item);
      if (out.length >= limit) return out;
    }
    if (out.length >= limit) return out;
  }
  return out;
}

function extractNightlyDollars(item) {
  const m = (item.price?.breakDown?.basePrice?.description || "").match(/\$([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

async function editPhoto(sourceUrl) {
  const prompt = [
    "Edit this exact Airbnb listing photo to maximize booking appeal.",
    "Declutter visible clutter and minor distractions (cables, remotes, half-empty drink containers, unfolded throws).",
    "Brighten and warm the interior lighting, professionally color-grade for inviting tones,",
    "replace any visible sky with a soft golden-hour gradient if windows show outdoors,",
    "sharpen architectural features.",
    "Warm modern color grading, soft lifted highlights, natural daylight.",
    "STRICT: do not add or remove furniture or fixtures. Keep the exact same camera angle,",
    "walls, ceiling, floor, windows, doors, and architectural features identical to the source.",
    "Photo-realistic interior architectural photography. No text, no watermarks, no logos.",
  ].join(" ");
  const result = await fal.subscribe(
    process.env.FAL_PREVIEW_MODEL || "fal-ai/flux-pro/kontext",
    { input: { prompt, image_url: sourceUrl, guidance_scale: 3.5, num_images: 1, output_format: "jpeg" }, logs: false }
  );
  return result?.data?.images?.[0]?.url;
}

async function draftEmail({ hostFirstName, shortAddress, scrapedTitle, photoCount, reviewCount, avgRating, nightly }) {
  const system = `You are a conversion copywriter for Restay, a one-time Airbnb listing optimization service ($79 = rewritten copy + 10 restyled photos + 30-day pricing report).

Audience: Airbnb hosts whose listings are public but obviously un-optimized.

Tone: peer-to-peer, specific, observational. NEVER salesy. Under 110 words.
Never promise booking-rate lift in numbers (FTC). Never say "AI" — describe as "our audit pipeline" or "our editor".

Structure:
1. One-line hook tying to a SPECIFIC observation about their listing (mention the address)
2. Three bullets — concrete audit findings (a copy issue, a photo issue, a pricing observation)
3. One soft CTA describing the $79 deliverable
4. The {{CTA}} placeholder on its own line

Return ONLY a JSON object:
{ "subject": "...", "bodyText": "..." }

Subject MUST be: "{shortAddress} — your free 60-second Airbnb audit"

DO NOT include the checkout URL in your bodyText — we append it programmatically as the {{CTA}} placeholder.`;

  const user = `Host first name: ${hostFirstName}
Address (shortened): ${shortAddress}
Listing photo count: ${photoCount}
Current title: "${scrapedTitle}"
Reviews: ${reviewCount} (avg ${avgRating?.toFixed(2) || "?"})
Nightly: ${nightly ? `$${nightly}/night` : "(unknown)"}
Tune-Up price: $79`;

  const resp = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: user }],
  });
  const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  let parsed = null;
  try { parsed = JSON.parse(stripFences(raw)); } catch {}
  return parsed || { subject: `${shortAddress} — your free 60-second Airbnb audit`, bodyText: "(failed)" };
}

function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function buildMjmlBody({ bodyText, beforeUrl, afterUrl, checkoutLink, banner }) {
  const cleaned = bodyText.split(/\n+/).map((l) => l.trim()).filter((l) => l && !l.includes(checkoutLink) && l !== "{{CTA}}").join("\n\n");
  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const bodyMj = paragraphs.map((p) =>
    `<mj-text font-size="16px" line-height="1.6" color="#111827" padding="0 0 14px">${escapeHtml(p).replace(/\n/g, "<br/>")}</mj-text>`
  ).join("\n      ");
  return `<mjml>
<mj-head>
  <mj-preview>A free 60-second audit of your Airbnb listing — before/after photo inside.</mj-preview>
  <mj-attributes>
    <mj-all font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" />
    <mj-text color="#111827" />
  </mj-attributes>
</mj-head>
<mj-body background-color="#f4f5f7">
  ${banner ? `<mj-section background-color="#fef3c7" padding="10px 24px"><mj-column><mj-text font-size="12px" color="#92400e" align="center">${escapeHtml(banner)}</mj-text></mj-column></mj-section>` : ""}
  <mj-section padding="24px 0 8px"><mj-column>
    <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">RESTAY</mj-text>
  </mj-column></mj-section>
  <mj-section background-color="#ffffff" padding="32px 32px 8px" border-radius="14px 14px 0 0"><mj-column>
    ${bodyMj}
  </mj-column></mj-section>
  <mj-section background-color="#ffffff" padding="8px 16px 0">
    <mj-column padding="0 6px">
      <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#64748b" padding="0 0 6px">BEFORE</mj-text>
      <mj-image src="${beforeUrl}" alt="Before" border-radius="10px" padding="0"/>
    </mj-column>
    <mj-column padding="0 6px">
      <mj-text align="center" font-size="11px" font-weight="700" letter-spacing="0.05em" color="#047857" padding="0 0 6px">AFTER</mj-text>
      <mj-image src="${afterUrl}" alt="After" border-radius="10px" padding="0"/>
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="20px 32px 12px"><mj-column>
    <mj-button href="${checkoutLink}" background-color="#111827" color="#ffffff" font-size="15px" font-weight="600" padding="6px 0 4px" inner-padding="14px 28px" border-radius="8px" align="left">See the full audit →</mj-button>
    <mj-text font-size="13px" color="#64748b" padding="6px 0 0">Full Tune-Up delivered in under 4 hours.</mj-text>
  </mj-column></mj-section>
  <mj-section background-color="#ffffff" padding="20px 20px 30px" border-radius="0 0 14px 14px"><mj-column>
    <mj-divider border-color="#e2e8f0" border-width="1px"/>
    <mj-text font-size="11px" color="#64748b" line-height="1.5">
      ${escapeHtml(BUSINESS_NAME)} &nbsp;·&nbsp; ${escapeHtml(BUSINESS_ADDRESS)}
      <br/>
      You're receiving this because your listing appears on a public Airbnb search result. We're an Airbnb listing optimization service.
      <br/>
      <a href="${APP_URL}/unsubscribe?l=demo" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
    </mj-text>
  </mj-column></mj-section>
</mj-body>
</mjml>`;
}

async function main() {
  log(`📦 gathering listings from ${RUN_IDS.length} Apify runs (target: ${BATCH_SIZE})...`);
  const listings = await gatherListings(RUN_IDS, BATCH_SIZE);
  log(`   found ${listings.length} unique listings\n`);
  if (listings.length === 0) { log("nothing to send"); return; }

  let sent = 0;
  for (const item of listings) {
    const id = String(item.id);
    const title = item.title || item.seoTitle || item.sharingConfigTitle || "Untitled";
    const city = item.location || "";
    const stateName = (item.locationSubtitle || "").split(",")[1]?.trim() || "";
    const shortAddress = `${city}${stateName ? ", " + stateName : ""}`;
    const host = item.host?.name || "there";
    const hostFirst = host.split(" ")[0];
    const photos = (item.images || []).map((p) => p.imageUrl).filter(Boolean);
    const nightly = extractNightlyDollars(item);
    const reviews = item.rating?.reviewsCount;
    const avg = item.rating?.guestSatisfaction;

    log(`\n────── ${shortAddress} · ${host} · $${nightly}/night ──────`);
    log(`  title: ${title.slice(0, 70)}`);

    log("  → fal.ai edit...");
    const editedUrl = await editPhoto(photos[0]);
    if (!editedUrl) { log("  ✗ edit failed, skipping"); continue; }

    log("  → claude email draft...");
    const drafted = await draftEmail({
      hostFirstName: hostFirst,
      shortAddress,
      scrapedTitle: title,
      photoCount: photos.length,
      reviewCount: reviews,
      avgRating: avg,
      nightly,
    });

    const checkoutLink = `${APP_URL}/l/${id}`;
    const banner = `[Preview routed to ${RECIPIENT} — would go to host: ${host} (${shortAddress})]`;
    const bodyText = `${drafted.bodyText.replace("{{CTA}}", "").trim()}\n\n${checkoutLink}\n\n— Restay`;
    const mjml = buildMjmlBody({ bodyText, beforeUrl: photos[0], afterUrl: editedUrl, checkoutLink, banner });
    const { html } = await mjml2html(mjml, { validationLevel: "soft" });

    const subject = `[Preview · would-go-to ${host}] ${drafted.subject}`;
    log(`  → sending to ${RECIPIENT}: "${subject.slice(0, 60)}..."`);
    const r = await resend.emails.send({
      from: `${BUSINESS_NAME} <outreach@${SENDER_DOMAIN}>`,
      to: RECIPIENT,
      replyTo: `replies@${SENDER_DOMAIN}`,
      subject,
      html,
      text: bodyText,
    });
    if (r.error) { log("  ✗ resend error:", r.error.message); continue; }
    log(`  ✓ sent (resend id: ${r.data?.id})`);
    sent++;
  }

  log(`\n📨 done — sent ${sent}/${listings.length} to ${RECIPIENT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
