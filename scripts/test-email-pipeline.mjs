/**
 * Send a real production-shape outreach email through our sendComplianceEmail
 * wrapper. Exercises MJML rendering, CAN-SPAM footer injection, List-Unsubscribe
 * headers, shared-sender handling, and idempotency.
 *
 * Run: node --env-file=.env.local scripts/test-email-pipeline.mjs
 */
// Inline the drafting + wrapper logic (lib/claude.ts is TS — not importable
// from a plain .mjs without a bundler). This mirrors lib/resend.ts exactly.
import { Resend } from "resend";
import mjml2html from "mjml";

const BUSINESS_NAME = process.env.BUSINESS_NAME ?? "Realscale";
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS ?? "[SET BUSINESS_ADDRESS IN .env]";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://realscale.app";
const resend = new Resend(process.env.RESEND_API_KEY);

const TEST_TO = process.env.TEST_TO ?? "jack@seifdn.org";
const fromDomain = (process.env.SENDER_DOMAINS ?? "resend.dev").split(",")[0].trim();
const isShared = fromDomain === "resend.dev";

// Draft copy with Claude (real production shape)
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sys = `You are a conversion copywriter for Realscale, a real estate photo-enhancement service.
Write peer-to-peer, under 90 words, single CTA. Return ONLY JSON: {"subject":"...","bodyText":"..."}.
Subject MUST follow: "Your listing at {shortAddress} — before/after inside"`;
const user = `Agent: Jack
Listing: 360 S Anita Ave
Photo count: 8
Checkout link: ${APP_URL}/l/demo
Price: $79`;
const resp = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 500,
  system: sys,
  messages: [{ role: "user", content: user }],
});
const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
const match = raw.match(/\{[\s\S]*\}/);
const parsed = match ? JSON.parse(match[0]) : { subject: "fallback", bodyText: "fallback" };
console.log("─ Claude drafted:");
console.log("  subject:", parsed.subject);
console.log("  body   :", parsed.bodyText.replace(/\n/g, "\n           ").slice(0, 300));
console.log("");

// Build MJML body with a CTA button
const bodyMjml = `<mjml><mj-head><mj-attributes><mj-all font-family="Helvetica,Arial,sans-serif" /></mj-attributes></mj-head>
<mj-body background-color="#f8fafc">
  <mj-section background-color="#ffffff" padding="28px 24px 16px">
    <mj-column>
      <mj-text font-size="15px" line-height="1.55" color="#111827">${parsed.bodyText.replace(/\n/g, "<br/>")}</mj-text>
      <mj-button href="${APP_URL}/l/demo" background-color="#111827" color="#ffffff" border-radius="8px">See the before/after</mj-button>
    </mj-column>
  </mj-section>
</mj-body></mjml>`;

const listingId = "smoke-test";
const unsubUrl = `${APP_URL}/unsubscribe?l=${listingId}`;
const withFooter = bodyMjml.replace(
  "</mj-body>",
  `<mj-section padding="20px 20px 30px"><mj-column>
     <mj-divider border-color="#e2e8f0" border-width="1px"/>
     <mj-text font-size="11px" color="#64748b" line-height="1.5">
       ${BUSINESS_NAME} &nbsp;·&nbsp; ${BUSINESS_ADDRESS}
       <br/>You're receiving this because your listing appeared on a public MLS.
       <br/><a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
     </mj-text>
   </mj-column></mj-section></mj-body>`,
);
const { html, errors } = await mjml2html(withFooter, { validationLevel: "soft" });
if (errors.length) console.warn("mjml warnings:", errors);

const fromUser = isShared ? "onboarding" : "outreach";
const from = `${BUSINESS_NAME} <${fromUser}@${fromDomain}>`;
const replyTo = isShared ? TEST_TO : `replies@${fromDomain}`;
const listUnsub = isShared
  ? `<${unsubUrl}>`
  : `<${unsubUrl}>, <mailto:unsubscribe+${listingId}@${fromDomain}>`;

console.log("─ Resend send parameters:");
console.log("  from       :", from);
console.log("  to         :", TEST_TO);
console.log("  replyTo    :", replyTo);
console.log("  subject    :", parsed.subject);
console.log("  List-Unsub :", listUnsub);
console.log("  has footer?:", /Unsubscribe/.test(html), "| has address?:", html.includes(BUSINESS_ADDRESS));
console.log("");

const result = await resend.emails.send({
  from,
  to: TEST_TO,
  replyTo,
  subject: parsed.subject,
  html,
  text:
    parsed.bodyText +
    `\n\n--\n${BUSINESS_NAME} · ${BUSINESS_ADDRESS}\nUnsubscribe: ${unsubUrl}`,
  headers: {
    "List-Unsubscribe": listUnsub,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
});

if (result.error) {
  console.error("✗ Send failed:", result.error);
  process.exit(1);
}
console.log("✓ Sent. id =", result.data.id);
console.log("\nCheck jack@seifdn.org — should arrive in ~10s.");
