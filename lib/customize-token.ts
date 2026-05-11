/**
 * HMAC-signed token for token-gated post-purchase customization.
 *
 * Goal: a customer who paid can return to /customize/<id>?t=<token> any time
 * to edit their site without us having to manage a session/login system. The
 * token is a hash of {leadId, email, secret} — stateless to verify, no DB
 * lookup. Compromise of one token only exposes one customer.
 *
 * Token format: "{leadId}.{sig24}" where sig24 is the first 24 hex chars of
 * the HMAC-SHA256 of "{leadId}:{email}".
 *
 * Required env: CUSTOMIZE_SECRET (32+ random chars, never rotated lightly —
 * rotating invalidates every existing customize link).
 */
import crypto from "node:crypto";
import { env } from "@/lib/env";

const SECRET = env("CUSTOMIZE_SECRET", "")!;

function hmac(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function signCustomizeToken(leadId: string, email: string): string {
  if (!SECRET) {
    throw new Error("CUSTOMIZE_SECRET not set — cannot sign customize tokens");
  }
  const payload = `${leadId}:${email.toLowerCase().trim()}`;
  const sig = hmac(payload).slice(0, 24);
  return `${leadId}.${sig}`;
}

/**
 * Verify a token. Returns leadId if valid, null otherwise.
 *
 * The caller must independently confirm that lead.status === "purchased" (or
 * equivalent) — this function only checks the cryptographic integrity of the
 * token, not whether the underlying record is allowed to be customized.
 */
export function verifyCustomizeToken(
  token: string | null | undefined,
  email: string,
): string | null {
  if (!SECRET || !token) return null;
  const idx = token.indexOf(".");
  if (idx <= 0) return null;
  const leadId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (sig.length !== 24) return null;

  const expected = hmac(`${leadId}:${email.toLowerCase().trim()}`).slice(0, 24);
  // Constant-time compare
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0 ? leadId : null;
}
