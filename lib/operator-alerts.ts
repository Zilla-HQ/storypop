/**
 * Operator alert emails — when an event happens that an operator should know
 * about (a hot inbound reply, a stuck order, a payment dispute), send a one-
 * line summary to the operator's inbox with full context inline.
 *
 * Why: if an operator only finds out by tailing logs / opening /admin, they're
 * already too late. A subject like "[Heat: 🔥] Acme Corp replied" surfaces in
 * the inbox they already check.
 *
 * Required env: OPERATOR_NOTIFY_EMAIL — comma-separated list of operator
 * inboxes. RESEND_API_KEY for sending. Both optional; fail silently if unset.
 */
import { env } from "@/lib/env";
import { Resend } from "resend";

const RESEND_KEY = env("RESEND_API_KEY", "");
const FROM = env("OPERATOR_ALERT_FROM", env("RESEND_FROM_ADDRESS", "alerts@example.com"))!;
const TO = env("OPERATOR_NOTIFY_EMAIL", "")!;

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

const HEAT_EMOJI: Record<string, string> = {
  interested: "🔥",
  price_question: "💰",
  style_question: "🎨",
  decline: "❄️",
  unsubscribe: "🚫",
  complex: "🤔",
};

export async function sendOperatorAlert(args: {
  /** Short subject — gets prefixed with "[Heat: <emoji>]" if classification is set. */
  subject: string;
  /** Optional reply classification — drives the heat emoji */
  classification?: string;
  /** The thing that happened — short prose. Will be the first paragraph. */
  summary: string;
  /** Optional details block — rendered as a code block under the summary. */
  details?: string;
  /** Optional link the operator should click to review (admin URL). */
  linkUrl?: string;
  linkLabel?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "RESEND_API_KEY not set" };
  if (!TO) return { ok: false, error: "OPERATOR_NOTIFY_EMAIL not set" };

  const emoji = args.classification ? (HEAT_EMOJI[args.classification] || "•") : "•";
  const subject = args.classification
    ? `[Heat: ${emoji}] ${args.subject}`
    : args.subject;

  const text = [
    args.summary,
    args.details ? `\n--- Details ---\n${args.details}` : "",
    args.linkUrl ? `\n${args.linkLabel || "Open"}: ${args.linkUrl}` : "",
  ].filter(Boolean).join("\n");

  const html = `<div style="font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:560px">
    <p style="margin:0 0 14px">${escapeHtml(args.summary)}</p>
    ${args.details ? `<pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-wrap:break-word">${escapeHtml(args.details)}</pre>` : ""}
    ${args.linkUrl ? `<p style="margin:14px 0 0"><a href="${escapeAttr(args.linkUrl)}" style="color:#2563eb;text-decoration:underline">${escapeHtml(args.linkLabel || "Open")}</a></p>` : ""}
  </div>`;

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: TO.split(",").map((s) => s.trim()).filter(Boolean),
      subject,
      text,
      html,
    });
    return result.error ? { ok: false, error: result.error.message } : { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ─── Provider-error detection + auto-alert ────────────────────────────
// Used by inngest/functions/preview.ts and inngest/functions/fulfillment.ts
// to convert silent failures into loud alerts within minutes. See
// META_ADS.md §5b for the case study that drove this.
import {
  detectProviderError as _detectProviderError,
  shouldPausePipeline as _shouldPausePipeline,
  type ProviderErrorInfo,
} from "@/lib/provider-errors";

const recentProviderAlerts = new Map<string, number>();
const PROVIDER_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export async function alertOnProviderError(
  err: unknown,
  pipelineStage: ProviderErrorInfo["pipelineStage"],
  context?: Record<string, string | number | null>,
): Promise<ProviderErrorInfo | null> {
  const info = _detectProviderError(err, pipelineStage);
  if (!info) return null;

  // Dedupe so a sustained outage doesn't carpet-bomb the operator inbox.
  const dedupeKey = `${info.provider}-${info.kind}-${pipelineStage}`;
  const last = recentProviderAlerts.get(dedupeKey);
  if (last && Date.now() - last < PROVIDER_DEDUPE_WINDOW_MS) return info;
  recentProviderAlerts.set(dedupeKey, Date.now());

  const ctx = context
    ? Object.entries(context).map(([k, v]) => `${k}: ${v}`).join("\n")
    : "";
  const willPause = _shouldPausePipeline(info);
  const actionRequired = willPause
    ? `ACTION REQUIRED: pipeline auto-paused (${pipelineStage}). Top up the affected provider, then unpause via /admin or scripts/set-pause-flags.ts.`
    : "";

  await sendOperatorAlert({
    subject: `${info.provider}: ${info.kind.replace(/_/g, " ")} during ${pipelineStage}`,
    summary: `Provider error detected mid-pipeline.\n\nProvider: ${info.provider}\nKind: ${info.kind}\nPipeline: ${pipelineStage}\n\n${actionRequired}`,
    details: `Original error:\n${info.message}\n\n${ctx}`,
  });

  return info;
}

export const shouldPausePipeline = _shouldPausePipeline;
export { type ProviderErrorInfo };
