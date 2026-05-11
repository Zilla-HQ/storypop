import { resolveMx } from "dns/promises";

// Per-domain MX-record cache for the lifetime of a function instance.
// Cold-outreach batches scrape many sites in the same domain (rare but
// happens — multi-location restaurants, agency parents). Avoid duplicate
// DNS lookups.
const MX_CACHE = new Map<string, boolean>();

/**
 * Returns true if the email's domain accepts mail (has a non-empty MX
 * record). Used as a pre-flight check before adding cold-outreach
 * recipients to the send queue — eliminates ~80% of "Address rejected:
 * domain not found" bounces with a sub-100ms DNS lookup.
 *
 * Failures (timeout, NXDOMAIN, NODATA) all return false — better to skip
 * a real address than risk a bounce.
 */
export async function hasMxRecord(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const cached = MX_CACHE.get(domain);
  if (cached !== undefined) return cached;
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("mx_timeout")), 4000)),
    ]);
    const ok = Array.isArray(records) && records.length > 0;
    MX_CACHE.set(domain, ok);
    return ok;
  } catch {
    MX_CACHE.set(domain, false);
    return false;
  }
}
