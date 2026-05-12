import { env } from "@/lib/env";

/**
 * Canonical Meta access-token resolver.
 *
 * Background: across the merchant-template's `lib/meta*` files the same
 * token was historically read under three different env-var names
 * (`META_CONVERSIONS_API_TOKEN`, `META_CAPI_ACCESS_TOKEN`,
 * `META_ADS_ACCESS_TOKEN`, `META_ACCESS_TOKEN`). When an operator set
 * the token under one name, only the files reading that exact name
 * worked — CAPI Purchase events silently dropped while campaign-management
 * code ran fine. This was the root cause of Phillip's broken Meta setup.
 *
 * One Meta System User token with both `ads_management` and `ads_read`
 * scopes drives every Meta call we make (CAPI server-side events +
 * campaign management + insights). Set ONE env var: `META_ACCESS_TOKEN`.
 *
 * Legacy names are still accepted as a fallback so existing Vercel
 * configs don't break during the rename window. Drop the fallbacks once
 * everyone has migrated to `META_ACCESS_TOKEN`.
 */
export function metaAccessToken(): string | undefined {
  return (
    env("META_ACCESS_TOKEN") ||
    env("META_CONVERSIONS_API_TOKEN") ||
    env("META_CAPI_ACCESS_TOKEN") ||
    env("META_ADS_ACCESS_TOKEN") ||
    undefined
  );
}
