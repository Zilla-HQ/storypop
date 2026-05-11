import { createHash } from "node:crypto";

/**
 * Deterministic referral code from email — same email always yields the
 * same code, no DB write needed to "create" one. This keeps the affiliate
 * system stateless: codes are generated on demand, validated by regex,
 * and only written to the orders table at checkout time. The leaderboard
 * is just `SELECT referral_code, count(*) FROM orders GROUP BY 1`.
 */
const SALT = process.env.REFERRAL_SALT ?? "realscale-affiliate-v1";

export function codeForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = createHash("sha256").update(`${SALT}:${normalized}`).digest("hex");
  // 8-char base36-ish slice — enough collision space for ~10M codes.
  return `r${hash.slice(0, 7).toUpperCase()}`;
}

const VALID = /^[A-Za-z0-9_-]{4,32}$/;
export function isValidCode(code: string): boolean {
  return VALID.test(code);
}

/** Per-paid-listing payout in cents. Adjust here, never hardcode in pages. */
export const REFERRAL_PAYOUT_CENTS = 2500;
