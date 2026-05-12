import { Resend } from "resend";
import mjml2html from "mjml";
import { env } from "@/lib/env";

const apiKey = env("RESEND_API_KEY");
const resend = apiKey ? new Resend(apiKey) : null;

const BUSINESS_NAME = env("BUSINESS_NAME", "StoryPop")!;
const BUSINESS_ADDRESS = env("BUSINESS_ADDRESS", "[SET BUSINESS_ADDRESS IN .env]")!;
const APP_URL = env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;

// Hard guard against shipping CAN-SPAM footers with a template-default
// brand name. If anyone copies .env.example without changing this, the
// app fails fast at first email send rather than blasting "Realscale"
// from a StoryPop domain.
if (BUSINESS_NAME === "Realscale" || BUSINESS_NAME === "Relist") {
  throw new Error(
    `BUSINESS_NAME is set to the template default ("${BUSINESS_NAME}"). Set BUSINESS_NAME=StoryPop in your environment.`,
  );
}

export interface SendEmailArgs {
  to: string;
  fromDomain: string; // e.g. "mail.storypop.shop"
  fromName?: string;
  subject: string;
  mjml: string; // MJML source body (no footer — we inject it)
  text: string; // Plain-text alternative
  replyTo?: string;
  tags?: { name: string; value: string }[];
  /**
   * Required. Used to build a durable unsubscribe link. We tie unsubs to the
   * listing-id so a prospect can opt-out of anything we send on their behalf
   * with one click.
   */
  listingId: string;
  /**
   * Optional — idempotency key so Inngest retries don't duplicate sends.
   */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  id: string | null;
  provider: "resend";
}

/**
 * Send an email through Resend with CAN-SPAM compliance baked in.
 *
 * Every outbound email auto-includes:
 *   1. Business name + physical address
 *   2. One-click unsubscribe link
 *   3. List-Unsubscribe headers (RFC 8058 one-click + mailto)
 *
 * There is no bypass. If you're tempted to add one, route through here anyway
 * and extend MJML with a variant — don't add a "raw send" helper.
 */
export async function sendComplianceEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn(`[resend] stub send to ${args.to}: ${args.subject}`);
    return { id: null, provider: "resend" };
  }

  const unsubUrl = `${APP_URL}/unsubscribe?l=${encodeURIComponent(args.listingId)}`;

  // Inject CAN-SPAM footer into MJML body.
  const withFooter = args.mjml.replace(
    "</mj-body>",
    `<mj-section padding="20px 20px 30px">
       <mj-column>
         <mj-divider border-color="#e2e8f0" border-width="1px" />
         <mj-text font-size="11px" color="#64748b" line-height="1.5">
           ${escapeHtml(BUSINESS_NAME)} &nbsp;·&nbsp; ${escapeHtml(BUSINESS_ADDRESS)}
           <br/>
           You're receiving this because your listing appeared on a public MLS. We're a real estate photo enhancement service.
           <br/>
           <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
         </mj-text>
       </mj-column>
     </mj-section>
     </mj-body>`,
  );

  // @types/mjml-core declares mjml2html as Promise-returning, but the runtime export is sync.
  // Await normalizes both.
  const { html, errors } = await mjml2html(withFooter, { validationLevel: "soft" });
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[mjml] warnings:", errors);
  }

  const textWithFooter =
    args.text.trimEnd() +
    `\n\n--\n${BUSINESS_NAME} · ${BUSINESS_ADDRESS}\nUnsubscribe: ${unsubUrl}\n`;

  // Resend's shared sandbox sender (`resend.dev`) only accepts `onboarding@`
  // as the from-address. Use the brand-prefixed user otherwise.
  const isSharedSender = args.fromDomain === "resend.dev";
  const fromUser = isSharedSender ? "onboarding" : "outreach";
  const from = `${args.fromName ?? BUSINESS_NAME} <${fromUser}@${args.fromDomain}>`;

  // Replies go to a brand-aligned mailbox so recipients never see the
  // operator's actual email/parent-company domain. REPLIES_EMAIL is forwarded
  // to the operator via an external forwarder (e.g. ImprovMX).
  const defaultReplyTo = env("REPLIES_EMAIL", isSharedSender
    ? `replies@storypop.shop`
    : `replies@${args.fromDomain}`)!;

  // mailto unsubscribe only works on an owned domain; on the shared sender
  // we drop the mailto variant and rely on the HTTPS one-click URL.
  const listUnsubValue = isSharedSender
    ? `<${unsubUrl}>`
    : `<${unsubUrl}>, <mailto:unsubscribe+${args.listingId}@${args.fromDomain}>`;

  const result = await resend.emails.send({
    from,
    to: args.to,
    replyTo: args.replyTo ?? defaultReplyTo,
    subject: args.subject,
    html,
    text: textWithFooter,
    headers: {
      "List-Unsubscribe": listUnsubValue,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: args.tags,
    ...(args.idempotencyKey
      ? { headers: { "Idempotency-Key": args.idempotencyKey } }
      : {}),
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return { id: result.data?.id ?? null, provider: "resend" };
}

export function pickSenderDomain(domains: string[], outreachCountToday: number): string {
  if (domains.length === 0) throw new Error("No sender domains configured");
  return domains[outreachCountToday % domains.length];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
