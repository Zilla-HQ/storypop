import { db, sites } from "@/db";
import { eq, isNull, or, sql } from "drizzle-orm";
import { findCompanyEmail } from "@/lib/find-company-email";
import { hasMxRecord } from "@/lib/validate-email";
import { isEmailBlocked } from "@/lib/email-domain-blocklist";
import { inngest } from "@/inngest/client";

/**
 * Walk every site that's missing a customer_email, scrape the
 * homepage for a contact email, MX-validate, and write back. For
 * sites where we successfully recovered an email, fire a fresh
 * `audit/run-requested` event so the audit-report email lands in the
 * lead's inbox.
 *
 * No Apify required — find-company-email is pure cheerio + direct
 * fetch.
 *
 * Capped at ~50 sites per run to keep the function under Vercel's
 * 300s budget.
 */

export interface BackfillResult {
  scanned: number;
  emailsFound: number;
  written: number;
  auditFired: number;
  failed: number;
}

export async function backfillMissingEmails(limit = 50): Promise<BackfillResult> {
  const result: BackfillResult = {
    scanned: 0,
    emailsFound: 0,
    written: 0,
    auditFired: 0,
    failed: 0,
  };

  const candidates = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(or(isNull(sites.customerEmail), eq(sites.customerEmail, "")))
    .limit(limit);

  result.scanned = candidates.length;

  // Modest parallelism — agency sites can be slow; 5 concurrent
  // fetches strikes the right balance.
  const concurrency = 5;
  for (let i = 0; i < candidates.length; i += concurrency) {
    const slice = candidates.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (s) => {
        try {
          const email = await findCompanyEmail(s.siteUrl);
          if (!email) return { siteId: s.id, status: "no_email" as const };
          // Skip Big Tech / megacorp domains — they'll never convert
          // and email there hurts our sender reputation.
          if (isEmailBlocked(email)) {
            return { siteId: s.id, status: "blocked" as const };
          }
          const ok = await hasMxRecord(email).catch(() => false);
          if (!ok) return { siteId: s.id, status: "no_mx" as const };
          return { siteId: s.id, email: email.toLowerCase(), status: "found" as const };
        } catch {
          return { siteId: s.id, status: "error" as const };
        }
      }),
    );

    for (const r of results) {
      if (r.status === "found" && "email" in r) {
        result.emailsFound += 1;
        try {
          // Update site row
          await db
            .update(sites)
            .set({ customerEmail: r.email, updatedAt: new Date() })
            .where(eq(sites.id, r.siteId));
          result.written += 1;

          // Fire a fresh audit so the audit-report email goes to the
          // newly-discovered address. The audit-report email function
          // only sends if customer_email is set — the original audit
          // ran before we had the email, so it didn't email anyone.
          // A re-audit creates a new audit row and re-fires the email
          // pipeline.
          const [siteRow] = await db
            .select({ id: sites.id, siteUrl: sites.siteUrl })
            .from(sites)
            .where(eq(sites.id, r.siteId))
            .limit(1);
          if (siteRow) {
            // We don't have the auditId yet — create a placeholder by
            // sending audit/run-requested with a generated UUID.
            // Actually the audit function expects siteId + auditId
            // but auditId is the row we'll insert. Simplest path:
            // call /api/audit ourselves, which inserts a fresh
            // audit row + fires the event.
            const appUrl =
              process.env.NEXT_PUBLIC_APP_URL ?? "https://sitebeat.tech";
            const apiRes = await fetch(`${appUrl}/api/audit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: siteRow.siteUrl,
                email: r.email,
                attribution: { utmSource: "email_backfill" },
              }),
            });
            if (apiRes.ok) result.auditFired += 1;
          }
        } catch {
          result.failed += 1;
        }
      }
    }
  }

  return result;
}
