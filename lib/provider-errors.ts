/**
 * Heuristic detection of "external provider is broken" errors —
 * out-of-credits, rate-limited, auth-invalid, service-down. Lets the
 * Inngest functions distinguish "transient retry, no big deal" from
 * "this customer is about to be stuck and we need to pause + alert."
 *
 * Restay (the airbnb merchant) hit this exact bug on 2026-05-07: fal.ai
 * ran dry mid-funnel after a Meta-ad-funded surge of self-serve
 * previews, the pipeline kept accepting paid orders into a 403 black
 * hole, the first paid customer waited 17 minutes in silence and
 * refunded. See META_ADS.md §5b for the full case study.
 *
 * Fix: detect these classes of errors at the call site, mark the
 * affected pipeline stage as paused in admin_settings, fire a loud
 * operator alert within minutes.
 */

export type ProviderErrorKind =
  | "credit_exhausted" // 402, "insufficient credits", quota burned, balance locked
  | "rate_limited"     // 429, slow down
  | "auth_invalid"     // 401/403 on a previously-working call, expired key
  | "service_outage"   // 5xx, provider is down
  | "unknown";

export interface ProviderErrorInfo {
  kind: ProviderErrorKind;
  provider: "falai" | "anthropic" | "resend" | "openai" | "stripe" | "apify" | "unknown";
  message: string;
  pipelineStage: "preview" | "fulfillment" | "outreach" | "checkout" | "discovery" | "unknown";
}

/**
 * Inspect any thrown error and figure out (a) which provider it came
 * from, (b) what kind of failure it is. Best-effort — falls through to
 * "unknown" for anything we can't recognize.
 */
export function detectProviderError(
  err: unknown,
  pipelineStage: ProviderErrorInfo["pipelineStage"] = "unknown",
): ProviderErrorInfo | null {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err).slice(0, 500);
  const lower = message.toLowerCase();

  // ─── Provider identification ────────────────────────────────────────
  let provider: ProviderErrorInfo["provider"] = "unknown";
  if (lower.includes("fal.ai") || lower.includes("fal_") || lower.includes("fal/")) provider = "falai";
  else if (lower.includes("anthropic") || lower.includes("claude")) provider = "anthropic";
  else if (lower.includes("resend")) provider = "resend";
  else if (lower.includes("openai") || lower.includes("gpt-")) provider = "openai";
  else if (lower.includes("apify")) provider = "apify";
  else if (lower.includes("stripe")) provider = "stripe";

  // ─── Failure-kind detection ─────────────────────────────────────────
  // Credit exhaustion is the highest-leverage signal — it's the one that
  // silently kills customers because the failure mode is "all subsequent
  // calls fail immediately, in seconds, with no recovery."
  const isCreditExhausted =
    lower.includes("insufficient credit") ||
    lower.includes("out of credit") ||
    lower.includes("credit exhausted") ||
    lower.includes("exhausted balance") || // fal.ai exact phrase
    lower.includes("balance is too low") ||
    lower.includes("balance_insufficient") ||
    lower.includes("user is locked") || // fal.ai when balance hits 0
    lower.includes("insufficient_quota") ||
    lower.includes("quota exceeded") ||
    lower.includes("billing required") ||
    lower.includes("payment_required") ||
    lower.includes("402");

  const isRateLimited =
    !isCreditExhausted &&
    (lower.includes("rate limit") ||
      lower.includes("rate_limit") ||
      lower.includes("too many requests") ||
      lower.includes("429"));

  const isAuthInvalid =
    !isCreditExhausted &&
    !isRateLimited &&
    (lower.includes("unauthorized") ||
      lower.includes("invalid api key") ||
      lower.includes("invalid_api_key") ||
      lower.includes("invalid token") ||
      lower.includes("authentication") ||
      lower.match(/\b401\b/) !== null ||
      lower.match(/\b403\b/) !== null);

  const isOutage =
    !isCreditExhausted &&
    !isRateLimited &&
    !isAuthInvalid &&
    (lower.match(/\b5\d\d\b/) !== null ||
      lower.includes("internal server error") ||
      lower.includes("service unavailable") ||
      lower.includes("bad gateway") ||
      lower.includes("gateway timeout"));

  let kind: ProviderErrorKind = "unknown";
  if (isCreditExhausted) kind = "credit_exhausted";
  else if (isRateLimited) kind = "rate_limited";
  else if (isAuthInvalid) kind = "auth_invalid";
  else if (isOutage) kind = "service_outage";

  if (kind === "unknown" && provider === "unknown") return null;

  return { kind, provider, message: message.slice(0, 500), pipelineStage };
}

/**
 * Should we auto-pause the pipeline for this error class?
 *
 * Yes for credit_exhausted (sticky failure — every subsequent call will
 * fail until credits are topped up) and auth_invalid (every call will
 * fail until token rotated).
 *
 * No for rate_limited (transient — Inngest retries with backoff handle
 * it correctly) or service_outage (transient — provider will recover).
 */
export function shouldPausePipeline(info: ProviderErrorInfo): boolean {
  return info.kind === "credit_exhausted" || info.kind === "auth_invalid";
}
