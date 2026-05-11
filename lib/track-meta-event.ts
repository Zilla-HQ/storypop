/**
 * Browser-side Meta Pixel wrapper.
 *
 * Meta's `fbq("track", X, ...)` silently drops events whose name isn't in its
 * standard list. Custom events MUST go through `fbq("trackCustom", ...)`.
 * Always use this helper instead of calling `fbq` directly.
 *
 * Server-side counterpart lives in `lib/meta-capi.ts`. Pair the two by passing
 * the same `eventId` to both — Meta dedupes by event_id.
 */

const STANDARD_META_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "AddToWishlist",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "Schedule",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
]);

type FbqParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (action: string, eventName: string, params?: FbqParams, opts?: { eventID?: string }) => void;
  }
}

export function trackMetaEvent(name: string, params?: FbqParams, eventId?: string): void {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return;
  const action = STANDARD_META_EVENTS.has(name) ? "track" : "trackCustom";
  fbq(action, name, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

/** Generate a UUID for browser↔server event_id dedupe. Falls back if crypto is missing. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
