import crypto from "node:crypto";

/**
 * HMAC token for "/unmute" — the customer permission flip that lets
 * the merchant show their business name / city / thumbnail on the
 * public spectacle layer (/live, social media auto-tweets, etc).
 *
 * Pattern:
 *   1. Default: customers' identity is redacted on public surfaces
 *      ("M—'s Dance Studio", no thumbnail).
 *   2. At checkout we present an opt-in checkbox (default UNCHECKED).
 *   3. In the post-purchase fulfillment email we include a /unmute/:token
 *      link the customer can hit at any time to flip the bit.
 *   4. The token is HMAC over `listingId|intent` where intent is one of
 *      "show" | "hide". A customer with a "show" token visits the link
 *      and we set listings.showPublicly = true.
 *
 * Why HMAC over a UUID lookup table? Two reasons:
 *   - Stateless: no DB write to mint the link, only on flip.
 *   - Self-validating: a leaked link can be rotated by changing the
 *     SHOW_PUBLICLY_SECRET env without touching DB rows.
 */

const ALGO = "sha256";

function secret(): string {
  return (
    process.env.SHOW_PUBLICLY_SECRET ??
    process.env.UNSUB_SECRET ?? // fallback shared with unsubscribe
    "change-me-set-SHOW_PUBLICLY_SECRET"
  );
}

export type ShowIntent = "show" | "hide";

export function mintUnmuteToken(listingId: string, intent: ShowIntent): string {
  const payload = `${listingId}|${intent}`;
  const sig = crypto.createHmac(ALGO, secret()).update(payload).digest("base64url");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export interface UnmuteTokenData {
  listingId: string;
  intent: ShowIntent;
}

export function verifyUnmuteToken(token: string): UnmuteTokenData | null {
  let raw: string;
  try {
    raw = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = raw.split("|");
  if (parts.length !== 3) return null;
  const [listingId, intent, sig] = parts;
  if (intent !== "show" && intent !== "hide") return null;
  const expected = crypto
    .createHmac(ALGO, secret())
    .update(`${listingId}|${intent}`)
    .digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return { listingId, intent };
}
