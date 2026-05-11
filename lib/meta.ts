import { env } from "@/lib/env";
import crypto from "crypto";

const PIXEL_ID = env("NEXT_PUBLIC_META_PIXEL_ID");
// CAPI uses its own token by convention, but our System User token already has
// the scopes needed to post Pixel events — fall back so we don't have to set
// duplicate env vars.
const ACCESS_TOKEN = env("META_CAPI_ACCESS_TOKEN") || env("META_ADS_ACCESS_TOKEN");
// Optional: paste the test_event_code from Meta Events Manager → Test Events
// during initial setup so events show up in the testing tab. Remove once
// you've confirmed events are flowing.
const TEST_EVENT_CODE = env("META_CAPI_TEST_CODE");

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s.toLowerCase().trim()).digest("hex");
}

/**
 * Send an event to Meta's Conversions API (server-side counterpart to the
 * client-side Pixel). Critical for iOS 14+ where the Pixel is unreliable.
 *
 * Pair the same event_id with the client-side fbq("track", ...) call to
 * dedupe — Meta merges them. For purely server-side events (e.g. webhooks
 * fired without a browser session) the event_id is just for idempotency.
 *
 * No-op if pixel ID + access token aren't set, so the rest of the app
 * is unaffected during dev / pre-launch.
 */
export async function sendMetaEvent(args: {
  eventName: "Purchase" | "Lead" | "InitiateCheckout" | "ViewContent" | "CompleteRegistration";
  eventId?: string;
  eventTime?: number; // unix seconds; defaults to now
  email?: string;
  phone?: string;
  /** USD value (will be coerced to currency string) */
  value?: number;
  currency?: string;
  /** Anything else Meta accepts under custom_data */
  customData?: Record<string, unknown>;
  /** Browser-side ids for dedup — pass these from the request when known */
  fbp?: string; // _fbp cookie
  fbc?: string; // _fbc cookie / fbclid
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { ok: false, error: "META_* env vars not set (no-op)" };
  }

  const userData: Record<string, unknown> = {};
  if (args.email) userData.em = [sha256(args.email)];
  if (args.phone) userData.ph = [sha256(args.phone.replace(/\D/g, ""))];
  if (args.fbp) userData.fbp = args.fbp;
  if (args.fbc) userData.fbc = args.fbc;
  if (args.clientIp) userData.client_ip_address = args.clientIp;
  if (args.userAgent) userData.client_user_agent = args.userAgent;

  const customData: Record<string, unknown> = { ...args.customData };
  if (args.value !== undefined) {
    customData.value = args.value;
    customData.currency = args.currency ?? "USD";
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: args.eventName,
        event_time: args.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: args.eventId,
        action_source: "website",
        event_source_url: args.sourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Meta CAPI ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
