import { db, partnerOutreach, sites } from "@/db";
import { ilike, or, notInArray, sql, inArray } from "drizzle-orm";
import { findCompanyEmail } from "@/lib/find-company-email";
import { hasMxRecord } from "@/lib/validate-email";
import { bulkAddProspects, sendPartnerEmail } from "@/lib/partner-outreach";

/**
 * Default keyword set used to filter the existing `sites` table for
 * agency-shaped URLs. Hostnames containing any of these substrings
 * are flagged as candidate partners. Conservative by design — it's
 * cheaper to miss a few agencies than to ship the partner pitch to
 * SMBs who'll mark it as spam.
 */
export const DEFAULT_AGENCY_KEYWORDS = [
  "agency",
  "studio",
  "marketing",
  "design",
  "media",
  "creative",
  "consulting",
  "consult",
  "digital",
  "webdesign",
  "web-design",
  "webdev",
  "seo",
  "wordpress",
  "shopify",
];

export interface ImportResult {
  matched: number; // URLs that matched keyword filter
  processed: number; // URLs we attempted to scrape
  withEmail: number; // URLs we extracted a usable email from
  added: number; // newly inserted into partner_outreach
  alreadyExisted: number;
  sent: number;
  failed: number;
  preview?: { siteUrl: string; email: string }[];
}

export interface ImportOptions {
  keywords?: string[];
  limit?: number; // max URLs to scrape this run
  dryRun?: boolean;
  autoSend?: boolean;
  // If true, pull URLs that are already in partner_outreach into the
  // candidate pool (e.g. for re-extracting emails on improved code).
  includeExisting?: boolean;
}

/**
 * Mine the existing `sites` table for agency-shaped URLs, scrape
 * contact emails, and feed them into the partner_outreach pipeline.
 *
 * This is the no-Apify workaround for partner discovery — we already
 * have thousands of URLs cached in `sites` from the audit-side
 * outreach. Most are SMBs but a measurable slice are agencies. The
 * keyword filter weeds out obvious non-matches before we burn HTTP
 * fetches.
 */
export async function importPartnersFromSites(
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const keywords = (opts.keywords ?? DEFAULT_AGENCY_KEYWORDS)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const dryRun = Boolean(opts.dryRun);
  const autoSend = Boolean(opts.autoSend);

  // Build keyword filter: site_url ILIKE %keyword% for any keyword.
  if (keywords.length === 0) {
    return {
      matched: 0,
      processed: 0,
      withEmail: 0,
      added: 0,
      alreadyExisted: 0,
      sent: 0,
      failed: 0,
    };
  }

  const candidates = await db
    .select({ siteUrl: sites.siteUrl })
    .from(sites)
    .where(
      or(
        ...keywords.map((k) => ilike(sites.siteUrl, `%${k}%`)),
      )!,
    )
    .limit(limit * 3); // overfetch — many will already be partners or have no extractable email

  // Drop URLs already in partner_outreach (matched on extracted
  // domain, not exact email — agencies often submit hello@example.com
  // from a yelpscrape, then we email contact@example.com, both
  // resolving to the same partner).
  let filtered = candidates;
  if (!opts.includeExisting) {
    const existingEmails = await db
      .select({ email: partnerOutreach.email })
      .from(partnerOutreach);
    const existingDomains = new Set(
      existingEmails
        .map((e) => e.email.split("@")[1]?.toLowerCase())
        .filter((d): d is string => Boolean(d)),
    );
    filtered = candidates.filter((c) => {
      try {
        const host = new URL(c.siteUrl).hostname.replace(/^www\./, "").toLowerCase();
        return !existingDomains.has(host);
      } catch {
        return false;
      }
    });
  }

  // Cap at limit
  const sliced = filtered.slice(0, limit);

  type Found = { siteUrl: string; email: string };
  const found: Found[] = [];
  const seenEmails = new Set<string>();

  // Scrape email + MX-validate, 5 in parallel
  const concurrency = 5;
  for (let i = 0; i < sliced.length; i += concurrency) {
    const slice = sliced.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async ({ siteUrl }) => {
        try {
          const email = await findCompanyEmail(siteUrl);
          if (!email) return null;
          const lower = email.toLowerCase();
          if (seenEmails.has(lower)) return null;
          const mxOk = await hasMxRecord(email).catch(() => false);
          if (!mxOk) return null;
          seenEmails.add(lower);
          return { siteUrl, email: lower };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) found.push(r);
    }
  }

  if (dryRun) {
    return {
      matched: candidates.length,
      processed: sliced.length,
      withEmail: found.length,
      added: 0,
      alreadyExisted: 0,
      sent: 0,
      failed: 0,
      preview: found.slice(0, 20),
    };
  }

  // Bulk add (dedupes vs existing partner_outreach + blacklist)
  const addResult = await bulkAddProspects(
    found.map((f) => ({
      email: f.email,
      notes: `Imported from sites: ${f.siteUrl}`,
    })),
  );

  // Auto-send only newly-inserted prospects (sendCount === 0).
  let sent = 0;
  let failed = 0;
  if (autoSend && addResult.inserted > 0) {
    const emails = found.map((f) => f.email);
    const matched = await db
      .select({
        id: partnerOutreach.id,
        email: partnerOutreach.email,
        sendCount: partnerOutreach.sendCount,
      })
      .from(partnerOutreach)
      .where(inArray(partnerOutreach.email, emails));

    for (const m of matched) {
      if (m.sendCount > 0) continue;
      try {
        await sendPartnerEmail({ prospectId: m.id, variant: "initial" });
        sent++;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("partner-import send failed for", m.email, (err as Error).message);
        failed++;
      }
    }
  }

  return {
    matched: candidates.length,
    processed: sliced.length,
    withEmail: found.length,
    added: addResult.inserted,
    alreadyExisted: (addResult.attempted ?? found.length) - addResult.inserted,
    sent,
    failed,
  };
}
