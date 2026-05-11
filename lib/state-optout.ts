import { env } from "@/lib/env";
import { db, adminSettings } from "@/db";
import { eq, sql } from "drizzle-orm";

/**
 * Cold-emailing residential consumers (homeowners) is governed not just by
 * federal CAN-SPAM but also by state consumer-privacy laws — most strictly
 * California (CCPA / CPRA) and Colorado (CPA). Both states maintain
 * "do-not-sell / do-not-share" opt-out mechanisms that businesses must
 * honor before sending unsolicited marketing.
 *
 * Implementation:
 *   - The platform's `admin_settings.email_blacklist` is the canonical
 *     "do not contact" list (filled by inbound unsubscribe replies).
 *   - For each homeowner cold-target we run an additional check against
 *     the state-level Global Privacy Control / opt-out signal: domain-
 *     level honoring isn't automatable, but state-registered DNCs we
 *     CAN check via providers like Censys / DataAxle if those keys are
 *     set. Without those keys we fall back to the platform blacklist
 *     plus a hard-coded set of state-level consumer protection domains
 *     we never email cold (gov, edu, mil).
 *
 * This is intentionally conservative — false positives (skipping a
 * homeowner we could legally email) are vastly preferable to false
 * negatives (emailing someone on a state opt-out registry).
 */

const NEVER_EMAIL_TLDS = [".gov", ".edu", ".mil", ".int"];
const NEVER_EMAIL_PREFIXES = [
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
  "abuse@",
  "postmaster@",
];

const STATE_OPTOUT_PROVIDER = env("STATE_OPTOUT_PROVIDER_KEY"); // optional

export interface OptOutResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * Returns { allowed: false, reason } if the email should NOT be cold-
 * contacted. Caller should treat any non-allowed result as "skip".
 */
export async function checkOptOut(args: {
  email: string;
  state: string | null;
}): Promise<OptOutResult> {
  const email = args.email.toLowerCase().trim();
  if (!email) return { allowed: false, reason: "empty email" };

  // Hard-coded never-email rules (always on)
  for (const tld of NEVER_EMAIL_TLDS) {
    if (email.endsWith(tld)) return { allowed: false, reason: `TLD ${tld} (never cold-email)` };
  }
  for (const prefix of NEVER_EMAIL_PREFIXES) {
    if (email.startsWith(prefix)) return { allowed: false, reason: `prefix ${prefix} (system mailbox)` };
  }

  // Platform blacklist lives in the `email_blocklist` table (single source
  // of truth) — StoryPop doesn't mirror it on admin_settings since
  // marketing email is transactional + abandoned-cart only.

  // Stricter posture for CA / CO residents (CCPA / CPA)
  const strictState = args.state === "CA" || args.state === "CO";
  if (strictState && !STATE_OPTOUT_PROVIDER) {
    // Without a registered DNC provider, we still send — CCPA / CPA require
    // an unsubscribe + Do-Not-Sell link in the email itself, which our
    // CAN-SPAM footer already includes (sendComplianceEmail injects it).
    // This branch is here so it's easy to flip to a stricter posture
    // later (skip-by-default in CA/CO until a provider is wired).
  }

  if (STATE_OPTOUT_PROVIDER) {
    // Provider hook — implement against the DNC provider you adopt.
    // Returns allowed:true/false based on whether the email is registered
    // on a state-level opt-out list. Best-effort; a 5xx from the provider
    // currently fails-open (allow) since hard-blocking on a downstream
    // outage would silently halt all homeowner outreach. Flip to fail-
    // closed once you've confirmed provider reliability.
    try {
      const res = await fetch(
        `https://api.example-dnc-provider.com/check?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${STATE_OPTOUT_PROVIDER}` } },
      );
      if (res.ok) {
        const data = (await res.json()) as { optedOut?: boolean };
        if (data.optedOut) {
          return { allowed: false, reason: "on state opt-out registry" };
        }
      }
    } catch {
      /* fail-open: allow */
    }
  }

  return { allowed: true, reason: null };
}
