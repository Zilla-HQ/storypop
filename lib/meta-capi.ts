import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * Convenience wrapper for the most common firing pattern (no PII). Used
 * by `/api/self-serve` and the Stripe webhook to dispatch a single CAPI
 * event with just a name + optional dedup id. For PII-attached events
 * (Purchase with hashed buyer email/phone), call `sendCapiEvent` directly.
 */
export async function sendMetaEvent(
  eventName:
    | "ViewContent"
    | "Contact"
    | "InitiateCheckout"
    | "Purchase"
    | "Lead",
  args?: { eventId?: string; bookId?: string; listingId?: string; value?: number },
): Promise<void> {
  try {
    await sendCapiEvent({
      eventName,
      eventId: args?.eventId,
      externalId: args?.bookId ?? args?.listingId,
      value: args?.value,
    });
  } catch {
    // CAPI failures are non-fatal.
  }
}

/**
 * Meta Conversions API dispatcher. Server-side counterpart to the client Pixel.
 *
 * Why this matters: iOS 14+ blocks ~30% of client Pixel events. CAPI from our
 * server gets through, attaches stronger user identifiers (hashed email/phone),
 * and gives Meta the data it needs to optimize ad spend toward actual buyers.
 *
 * Suggested events for a merchant template:
 *   - ViewContent       on the public listing/preview page
 *   - InitiateCheckout  on /api/checkout (when a buyer starts paying)
 *   - Purchase          on Stripe checkout.session.completed webhook
 *
 * Each call is fire-and-forget: a CAPI failure must NEVER block the user-facing
 * request. Caller should `.catch()` the returned promise.
 */

const PIXEL_ID = env("NEXT_PUBLIC_META_PIXEL_ID");
const ACCESS_TOKEN = env("META_CONVERSIONS_API_TOKEN");
const TEST_EVENT_CODE = env("META_TEST_EVENT_CODE"); // optional — for /test_events in Events Manager
const API_VERSION = env("META_API_VERSION", "v19.0")!;

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s.toLowerCase().trim()).digest("hex");
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = "1" + digits; // assume US if no country code
  return digits;
}

export interface CapiEventArgs {
  eventName: "ViewContent" | "Contact" | "InitiateCheckout" | "Purchase" | "Lead";
  eventId?: string;            // for dedup with client Pixel; if omitted we generate one
  eventSourceUrl?: string;     // page where event happened
  ip?: string | null;          // client IP (extract via extractClientIp)
  userAgent?: string | null;   // client UA
  fbp?: string | null;         // _fbp cookie
  fbc?: string | null;         // _fbc cookie
  email?: string | null;       // raw — hashed here
  phone?: string | null;       // raw — normalized + hashed here
  externalId?: string | null;  // e.g., `order-${id}` — hashed here
  value?: number;              // dollar amount (for Purchase / InitiateCheckout)
  currency?: string;           // e.g., "USD"
  contentName?: string;        // human-readable
  contentIds?: string[];       // for catalog products
}

export async function sendCapiEvent(args: CapiEventArgs): Promise<{ ok: boolean; error?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[capi] not configured (need NEXT_PUBLIC_META_PIXEL_ID + META_CONVERSIONS_API_TOKEN)");
    return { ok: false, error: "not configured" };
  }

  const userData: Record<string, unknown> = {};
  if (args.ip) userData.client_ip_address = args.ip;
  if (args.userAgent) userData.client_user_agent = args.userAgent;
  if (args.fbp) userData.fbp = args.fbp;
  if (args.fbc) userData.fbc = args.fbc;
  if (args.email) userData.em = [sha256(args.email)];
  if (args.phone) userData.ph = [sha256(normalizePhone(args.phone))];
  if (args.externalId) userData.external_id = [sha256(args.externalId)];

  const customData: Record<string, unknown> = {};
  if (args.value !== undefined) customData.value = args.value;
  if (args.currency) customData.currency = args.currency;
  if (args.contentName) customData.content_name = args.contentName;
  if (args.contentIds && args.contentIds.length) customData.content_ids = args.contentIds;

  const event: Record<string, unknown> = {
    event_name: args.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: args.eventId || crypto.randomUUID(),
    action_source: "website",
    user_data: userData,
  };
  if (args.eventSourceUrl) event.event_source_url = args.eventSourceUrl;
  if (Object.keys(customData).length > 0) event.custom_data = customData;

  const body: Record<string, unknown> = {
    data: [event],
    access_token: ACCESS_TOKEN,
  };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[capi] ${args.eventName} failed: ${res.status} ${text.slice(0, 400)}`);
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[capi] ${args.eventName} error:`, msg);
    return { ok: false, error: msg };
  }
}

/** Pull the client's originating IP from a Next.js Request, handling proxies. */
export function extractClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0].trim();
    if (ip) return ip;
  }
  return req.headers.get("x-real-ip") || null;
}

/** Pull Meta tracking cookies (_fbp, _fbc) from a Next.js Request. */
export function extractMetaCookies(req: Request): { fbp?: string; fbc?: string } {
  const header = req.headers.get("cookie") || "";
  const out: { fbp?: string; fbc?: string } = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "_fbp") out.fbp = v;
    else if (k === "_fbc") out.fbc = v;
  }
  return out;
}
