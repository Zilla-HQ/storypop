import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const apiKey = env("ANTHROPIC_API_KEY");
const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")!;

const client = apiKey ? new Anthropic({ apiKey }) : null;

export async function callClaude(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  if (!client) {
    // eslint-disable-next-line no-console
    console.warn("[claude] stub — ANTHROPIC_API_KEY missing");
    return "";
  }

  const resp = await client.messages.create({
    model,
    max_tokens: args.maxTokens ?? 1024,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  const block = resp.content[0];
  return block && block.type === "text" ? block.text : "";
}

export interface DraftedEmail {
  subject: string;
  bodyText: string;
  bodyMjml: string;
}

/**
 * Draft a personalized outreach email for a qualified listing.
 * Subject follows the spec: "Your listing at {short address} — before/after inside"
 * Body: < 90 words, single CTA (the checkout link).
 */
export async function draftOutreachEmail(args: {
  agentFirstName: string;
  shortAddress: string;
  photoCount: number;
  checkoutLink: string;
  beforeUrl: string;
  afterUrl: string;
  price: string;
}): Promise<DraftedEmail> {
  const system = `You are a conversion copywriter for Realscale, a real estate photo-enhancement service.
Write in a peer-to-peer tone (no "Dear Agent"). Under 90 words. Single CTA. No emojis.
Never over-promise delivery times. Never mention "AI" in the body — describe as "our enhancement pipeline".

Return ONLY a JSON object:
{
  "subject": "...",
  "bodyText": "..."
}

Subject MUST follow the exact template: "Your listing at {shortAddress} — before/after inside"

DO NOT include the checkout URL in your bodyText — we append it programmatically.
End your bodyText with a placeholder line "{{CTA}}" where the URL should go.`;

  const user = `Agent: ${args.agentFirstName}
Listing: ${args.shortAddress}
Photo count: ${args.photoCount}
Price: ${args.price}`;

  const raw = await callClaude({ system, user, maxTokens: 600 });
  let subject = `Your listing at ${args.shortAddress} — before/after inside`;
  let bodyText = fallbackBody(args);

  try {
    const parsed = JSON.parse(raw) as { subject?: string; bodyText?: string };
    if (parsed.subject) subject = parsed.subject;
    if (parsed.bodyText) bodyText = parsed.bodyText;
  } catch {
    // use fallback
  }

  // Defensive cleanup: strip any URL the LLM ignored instructions and inserted,
  // un-break URLs that got line-wrapped, then append the canonical CTA on its
  // own line. This keeps the link clickable in plain-text clients (and is a
  // no-op for the HTML version, which renders the URL as a button).
  bodyText = bodyText
    // Repair a URL split onto two lines: "https://x.com\n/path" → "https://x.com/path"
    .replace(/(https?:\/\/[a-zA-Z0-9.-]+)\s*\n\s*(\/[^\s]+)/g, "$1$2")
    // Drop any other LLM-inserted instance of our checkout link (we'll append once)
    .split("\n")
    .filter((line) => !line.trim().includes(args.checkoutLink))
    // Drop the {{CTA}} placeholder if present
    .filter((line) => line.trim() !== "{{CTA}}")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Append canonical CTA on its own line, never split.
  bodyText = `${bodyText}\n\n${args.checkoutLink}\n\n— Realscale`;

  const bodyMjml = buildMjml({
    bodyText,
    beforeUrl: args.beforeUrl,
    afterUrl: args.afterUrl,
    checkoutLink: args.checkoutLink,
  });

  return { subject, bodyText, bodyMjml };
}

function fallbackBody(args: {
  agentFirstName: string;
  shortAddress: string;
  photoCount: number;
  checkoutLink: string;
  price: string;
}): string {
  return `Hey ${args.agentFirstName},

Your listing at ${args.shortAddress} caught my eye. I ran two of your photos through our enhancement pipeline — before/after below.

Full set of ${args.photoCount} enhanced photos back to you in under 2 hours for ${args.price}.

${args.checkoutLink}

If not now, no worries — happy listing.

— Realscale`;
}

function buildMjml(args: {
  bodyText: string;
  beforeUrl: string;
  afterUrl: string;
  checkoutLink: string;
}): string {
  // Strip the checkout link from the body — we'll render it as a CTA button below.
  const cleanedBody = args.bodyText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(args.checkoutLink))
    .join("\n\n");

  const paragraphs = cleanedBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const bodyMj = paragraphs
    .map(
      (p) =>
        `<mj-text font-size="16px" line-height="1.6" color="#111827" padding="0 0 14px">${escapeHtml(p).replace(/\n/g, "<br/>")}</mj-text>`,
    )
    .join("\n      ");

  return `<mjml>
<mj-head>
  <mj-preview>An AI-staged before/after for your listing — full set in under 2 hours.</mj-preview>
  <mj-attributes>
    <mj-all font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" />
    <mj-text color="#111827" />
  </mj-attributes>
  <mj-style>
    .label { letter-spacing: 0.05em; text-transform: uppercase; font-size: 11px; font-weight: 700; }
    .label-before { color: #64748b; }
    .label-after { color: #047857; }
  </mj-style>
</mj-head>
<mj-body background-color="#f4f5f7">
  <!-- brand bar -->
  <mj-section padding="24px 0 8px">
    <mj-column>
      <mj-text align="center" font-size="13px" font-weight="700" letter-spacing="0.12em" color="#111827">REALSCALE</mj-text>
    </mj-column>
  </mj-section>

  <!-- body -->
  <mj-section background-color="#ffffff" padding="32px 32px 8px" border-radius="14px 14px 0 0">
    <mj-column>
      ${bodyMj}
    </mj-column>
  </mj-section>

  <!-- side-by-side comparator -->
  <mj-section background-color="#ffffff" padding="8px 16px 0">
    <mj-column padding="0 6px">
      <mj-text css-class="label label-before" align="center" padding="0 0 6px">Before</mj-text>
      <mj-image src="${args.beforeUrl}" alt="Before" border-radius="10px" padding="0"/>
    </mj-column>
    <mj-column padding="0 6px">
      <mj-text css-class="label label-after" align="center" padding="0 0 6px">After</mj-text>
      <mj-image src="${args.afterUrl}" alt="After" border-radius="10px" padding="0"/>
    </mj-column>
  </mj-section>

  <!-- CTA -->
  <mj-section background-color="#ffffff" padding="20px 32px 12px">
    <mj-column>
      <mj-button href="${args.checkoutLink}" background-color="#111827" color="#ffffff" font-size="15px" font-weight="600" padding="6px 0 4px" inner-padding="14px 28px" border-radius="8px" align="left">
        See the full before/after →
      </mj-button>
      <mj-text font-size="13px" color="#64748b" padding="6px 0 0">
        Full set of enhanced photos delivered to you in under 2 hours.
      </mj-text>
    </mj-column>
  </mj-section>

  <!-- proof strip -->
  <mj-section background-color="#ffffff" padding="16px 32px 24px" border-radius="0 0 14px 14px">
    <mj-column>
      <mj-divider border-color="#e5e7eb" border-width="1px" padding="0 0 14px"/>
      <mj-text font-size="12px" color="#64748b" line-height="1.6">
        ✓ NAR-compliant "Virtually Staged" disclosure on every photo<br/>
        ✓ Photos returned in your MLS resolution<br/>
        ✓ Under 2-hour delivery
      </mj-text>
    </mj-column>
  </mj-section>
</mj-body>
</mjml>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type ReplyClassification =
  | "price_question"
  | "style_question"
  | "decline"
  | "unsubscribe"
  | "complex"
  | "interested";

/**
 * Classify an inbound email reply into one of 5 buckets.
 */
export async function classifyReply(bodyText: string): Promise<ReplyClassification> {
  const system = `You triage inbound email replies from real estate agents responding to a photo-enhancement pitch.

Classify into EXACTLY one of:
- "interested": positive intent — "yes", "tell me more", "I'd like to try it", "send me details", "let's do it"
- "price_question": asking how much, discounts, payment, "what does it cost"
- "style_question": asking about staging styles, samples, turnaround details, "what do my photos look like enhanced"
- "decline": soft no, not interested, not right now, "we have someone already", "no thanks"
- "unsubscribe": stop, remove me, unsubscribe, take me off list, do not contact
- "complex": anything else — compliance questions, legal, custom requests, angry, confused, off-topic

Return ONLY JSON: {"classification": "..."}.`;

  const raw = await callClaude({ system, user: bodyText, maxTokens: 100 });
  try {
    const parsed = JSON.parse(raw) as { classification?: ReplyClassification };
    if (parsed.classification) return parsed.classification;
  } catch {
    // fall through
  }
  return "complex";
}

/**
 * Draft an auto-reply for a classified inbound email.
 * Returns null for classifications that should NOT be auto-replied (unsubscribe, complex).
 */
export async function draftAutoReply(args: {
  classification: ReplyClassification;
  inboundBody: string;
  agentFirstName: string;
  checkoutLink: string;
}): Promise<string | null> {
  if (args.classification === "unsubscribe" || args.classification === "complex") {
    return null;
  }

  const system = `You reply to an inbound email on behalf of Realscale. Under 70 words, peer-to-peer, no emojis.
For price questions, clearly state pricing ($79 standard / $149 premium / $199 rush) and link to checkout.
For style questions, mention the four presets (Modern, Farmhouse, Mid-Century, Coastal) and link to checkout.
Always close with the checkout link on its own line.`;

  const user = `Inbound classification: ${args.classification}
Inbound body:
${args.inboundBody}

Agent first name: ${args.agentFirstName}
Checkout link: ${args.checkoutLink}`;

  const raw = await callClaude({ system, user, maxTokens: 400 });
  return raw.trim() || null;
}

// ─── StoryPop-specific: book story drafter ────────────────────────────────

export interface DraftedStory {
  title: string;
  dedication: string;
  pages: { sceneDescription: string; body: string }[];
}

/**
 * Draft a personalized children's story. Returns structured JSON with a
 * title, dedication, and 12–16 pages. Each page has a body (1–3 sentences,
 * age-appropriate) and a `sceneDescription` the illustrator agent uses
 * to render the page image.
 *
 * Caller must pass the output through `storySafetyGate` before image-gen.
 */
export async function draftStory(args: {
  childName: string;
  childAge: number;
  pronouns: string;
  archetype: string;
}): Promise<DraftedStory> {
  const ageBand =
    args.childAge <= 4 ? "2-4 (very simple, rhyming, repetition)"
    : args.childAge <= 7 ? "5-7 (short sentences, vivid scenes)"
    : "8-10 (richer vocabulary, light arcs)";
  const pageCount = args.archetype === "bedtime" ? 14 : 16;

  const system = `You are a children's book author. Draft a ${pageCount}-page story for the given inputs.
Every page is 1-3 sentences and ends with a beat that gives the illustrator a clear scene.
Respect age-band reading level: ${ageBand}.
Output STRICT JSON: { "title": string, "dedication": string, "pages": [{ "sceneDescription": string, "body": string }] }.
No commentary, no markdown, just JSON.
HARD RULES:
- No violence beyond mild peril. No romance/sexuality. No real-world political figures.
- No branded characters (Disney, Marvel, Pokémon, Bluey, Paw Patrol, Sesame Street, etc).
- No weapons, no substance use, no scary monsters with realistic features.
- Bedtime archetype ends with the protagonist asleep.`;

  const user = `Inputs:
- Name: ${args.childName}
- Age: ${args.childAge}
- Pronouns: ${args.pronouns}
- Archetype: ${args.archetype}`;

  const raw = await callClaude({ system, user, maxTokens: 2500 });
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as DraftedStory;
}
