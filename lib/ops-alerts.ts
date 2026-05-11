/**
 * Centralized "send an ops alert email" helper. Used whenever the
 * pipeline detects a silent failure that the operator needs to know
 * about within minutes (provider out of credits, payment stuck,
 * webhook lag, etc.).
 *
 * Resend send is fire-and-forget — failure to send the alert is
 * logged but doesn't block the calling pipeline. The whole point is
 * we already have a problem; failing the alert too just compounds.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";
import { detectProviderError, shouldPausePipeline, type ProviderErrorInfo } from "@/lib/provider-errors";

const apiKey = env("RESEND_API_KEY");
const resend = apiKey ? new Resend(apiKey) : null;

const SENDER_DOMAINS = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FROM_DOMAIN = SENDER_DOMAINS[0] ?? "mail.restay.agency";
const OPERATOR_EMAIL = env("OPERATOR_EMAIL", env("REPLIES_EMAIL", "jack@seifdn.org"))!;
const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://restay.agency")!;

export interface OpsAlertArgs {
  /** Short imperative subject — appears in the operator's inbox preview. */
  subject: string;
  /** Severity tag — drives email styling + filter rules in Gmail. */
  severity: "info" | "warning" | "critical";
  /** Plain-text body. */
  body: string;
  /** Optional: deduplication key. If two alerts in 10 min share a key, the second is suppressed. */
  dedupeKey?: string;
}

// In-memory dedupe — survives only within a single Vercel function lifetime,
// so it's a soft cap (won't perfectly suppress across edge worker restarts,
// but cuts the worst spam during a sustained outage).
const recentAlerts = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export async function sendOpsAlert(args: OpsAlertArgs): Promise<void> {
  if (args.dedupeKey) {
    const last = recentAlerts.get(args.dedupeKey);
    if (last && Date.now() - last < DEDUPE_WINDOW_MS) return;
    recentAlerts.set(args.dedupeKey, Date.now());
  }

  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn(`[ops-alert] stub: ${args.severity}: ${args.subject}`);
    return;
  }

  const icon = args.severity === "critical" ? "🚨" : args.severity === "warning" ? "⚠" : "ℹ";
  try {
    await resend.emails.send({
      from: `Restay Ops <ops@${FROM_DOMAIN}>`,
      to: OPERATOR_EMAIL,
      subject: `${icon} ${args.subject}`,
      text: `${args.body}

---
Severity: ${args.severity.toUpperCase()}
Time:     ${new Date().toISOString()}
Admin:    ${APP_URL}/admin
`,
      tags: [
        { name: "type", value: "ops_alert" },
        { name: "severity", value: args.severity },
      ],
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ops-alert] send failed:", err);
  }
}

/**
 * Convenience: detect provider error from a thrown exception, fire an
 * ops alert with structured context. Returns the ProviderErrorInfo or
 * null if the error wasn't recognized as a provider issue.
 */
export async function alertOnProviderError(
  err: unknown,
  pipelineStage: ProviderErrorInfo["pipelineStage"],
  context?: Record<string, string | number | null>,
): Promise<ProviderErrorInfo | null> {
  const info = detectProviderError(err, pipelineStage);
  if (!info) return null;

  const ctx = context
    ? "\n\nContext:\n" + Object.entries(context).map(([k, v]) => `  ${k}: ${v}`).join("\n")
    : "";

  const severity: OpsAlertArgs["severity"] =
    info.kind === "credit_exhausted" || info.kind === "auth_invalid" ? "critical" : "warning";

  const actionRequired = shouldPausePipeline(info)
    ? `\n\nACTION REQUIRED: pipeline auto-paused (${pipelineStage}). Top up the affected provider, then unpause from /admin.`
    : "";

  await sendOpsAlert({
    severity,
    subject: `${info.provider}: ${info.kind.replace(/_/g, " ")} during ${pipelineStage}`,
    body: `Provider:    ${info.provider}
Kind:        ${info.kind}
Pipeline:    ${pipelineStage}

Original error message:
${info.message}${ctx}${actionRequired}`,
    dedupeKey: `${info.provider}-${info.kind}-${pipelineStage}`,
  });

  return info;
}
