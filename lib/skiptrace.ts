import { env } from "@/lib/env";

/**
 * Find an email for a person given their name + zip / city / state.
 *
 * Tier 1: Hunter.io email-finder — given (first, last, domain). For
 *   homeowners we don't have a domain, so this is best-effort: we try
 *   Hunter's "people search" endpoint instead.
 * Tier 2: Apollo.io people enrichment — robust for residential where we
 *   only have name + location.
 *
 * Both providers are env-flag-gated. If neither key is set, returns null.
 *
 * Caller is expected to feed the result through `lib/state-optout`'s
 * registry check before any send (CA / CO consumer privacy).
 */

const HUNTER = env("HUNTER_API_KEY");
const APOLLO = env("APOLLO_API_KEY");

export interface SkiptraceResult {
  email: string | null;
  confidence: "high" | "medium" | "low" | null;
  source: "hunter" | "apollo" | null;
}

const NULL_RESULT: SkiptraceResult = { email: null, confidence: null, source: null };

export async function skiptrace(args: {
  firstName: string | null;
  lastName: string | null;
  fullName?: string | null;
  city: string;
  state: string;
  zip: string;
}): Promise<SkiptraceResult> {
  if (!args.firstName && !args.fullName) return NULL_RESULT;

  // Tier 1: Apollo (better for residential / non-domain searches)
  if (APOLLO) {
    try {
      const r = await viaApollo(args);
      if (r.email) return r;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[apollo] ${(e as Error).message}`);
    }
  }

  // Tier 2: Hunter
  if (HUNTER) {
    try {
      const r = await viaHunter(args);
      if (r.email) return r;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[hunter] ${(e as Error).message}`);
    }
  }

  return NULL_RESULT;
}

async function viaApollo(args: {
  firstName: string | null;
  lastName: string | null;
  fullName?: string | null;
  city: string;
  state: string;
  zip: string;
}): Promise<SkiptraceResult> {
  const body: Record<string, unknown> = {
    api_key: APOLLO,
    reveal_personal_emails: true,
  };
  if (args.firstName) body.first_name = args.firstName;
  if (args.lastName) body.last_name = args.lastName;
  if (!args.firstName && args.fullName) body.name = args.fullName;
  if (args.zip) body.person_locations = [`${args.city}, ${args.state} ${args.zip}`];

  const res = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apollo ${res.status}`);
  const data = (await res.json()) as {
    person?: { email?: string; personal_emails?: string[]; email_status?: string };
  };
  const email = data.person?.email ?? data.person?.personal_emails?.[0] ?? null;
  if (!email) return NULL_RESULT;
  return {
    email,
    confidence:
      data.person?.email_status === "verified"
        ? "high"
        : data.person?.email_status === "guessed"
          ? "low"
          : "medium",
    source: "apollo",
  };
}

async function viaHunter(args: {
  firstName: string | null;
  lastName: string | null;
  fullName?: string | null;
  city: string;
  state: string;
  zip: string;
}): Promise<SkiptraceResult> {
  // Hunter's email-finder requires a domain, which we don't have for
  // homeowners. Use their people-search-by-name + location instead.
  const params = new URLSearchParams({
    api_key: HUNTER!,
    full_name:
      args.fullName ?? `${args.firstName ?? ""} ${args.lastName ?? ""}`.trim(),
  });
  if (args.zip) params.set("location", `${args.city}, ${args.state} ${args.zip}`);

  // The /v2/people-search endpoint isn't always enabled per plan; fall back
  // to /v2/email-finder with a guessed domain if needed.
  const res = await fetch(
    `https://api.hunter.io/v2/people-search?${params.toString()}`,
  );
  if (!res.ok) throw new Error(`Hunter ${res.status}`);
  const data = (await res.json()) as {
    data?: { email?: string; confidence?: number };
  };
  const email = data.data?.email ?? null;
  if (!email) return NULL_RESULT;
  return {
    email,
    confidence:
      (data.data?.confidence ?? 0) > 80
        ? "high"
        : (data.data?.confidence ?? 0) > 50
          ? "medium"
          : "low",
    source: "hunter",
  };
}
