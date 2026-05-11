import { db, audits, sites } from "@/db";
import { and, desc, eq, like } from "drizzle-orm";
import { domainFromSiteUrl, normalizeDomain } from "@/lib/domain";

export interface PublicAuditSummary {
  auditId: string;
  siteId: string;
  siteUrl: string;
  domain: string;
  score: number;
  report: unknown;
  runAt: Date | null;
  createdAt: Date;
}

/**
 * Find the most recent completed audit for `domain`. Sites are stored
 * with full URLs; we can't index by hostname directly, so we fetch
 * candidate rows by `LIKE '%domain%'` and filter in JS.
 */
export async function findLatestPublicAudit(
  domain: string,
): Promise<PublicAuditSummary | null> {
  const norm = normalizeDomain(domain);
  if (!norm) return null;

  const candidateSites = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(like(sites.siteUrl, `%${norm}%`))
    .limit(50);

  const matchingSiteIds = candidateSites
    .filter((s) => domainFromSiteUrl(s.siteUrl) === norm)
    .map((s) => s.id);

  if (matchingSiteIds.length === 0) return null;

  // Fetch the most recent complete audit across any matching site.
  const rows = await db
    .select({
      auditId: audits.id,
      siteId: audits.siteId,
      siteUrl: sites.siteUrl,
      score: audits.score,
      report: audits.report,
      runAt: audits.runAt,
      createdAt: audits.createdAt,
    })
    .from(audits)
    .innerJoin(sites, eq(sites.id, audits.siteId))
    .where(and(eq(audits.status, "complete")))
    .orderBy(desc(audits.runAt))
    .limit(200);

  const filtered = rows.filter((r) => matchingSiteIds.includes(r.siteId));
  const latest = filtered[0];
  if (!latest || latest.score === null || latest.score === undefined) return null;

  return {
    auditId: latest.auditId,
    siteId: latest.siteId,
    siteUrl: latest.siteUrl,
    domain: norm,
    score: latest.score,
    report: latest.report ?? null,
    runAt: latest.runAt,
    createdAt: latest.createdAt,
  };
}

export interface RecentAuditEntry {
  domain: string;
  siteUrl: string;
  score: number;
  runAt: Date | null;
}

/**
 * Most recently audited domains, used to (a) seed the sitemap and (b)
 * populate the "/seo-audit" index page.
 */
export async function listRecentAudits(limit = 500): Promise<RecentAuditEntry[]> {
  const rows = await db
    .select({
      siteUrl: sites.siteUrl,
      score: audits.score,
      runAt: audits.runAt,
    })
    .from(audits)
    .innerJoin(sites, eq(sites.id, audits.siteId))
    .where(eq(audits.status, "complete"))
    .orderBy(desc(audits.runAt))
    .limit(limit * 3);

  const seen = new Set<string>();
  const out: RecentAuditEntry[] = [];
  for (const r of rows) {
    if (r.score === null || r.score === undefined) continue;
    const d = domainFromSiteUrl(r.siteUrl);
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push({ domain: d, siteUrl: r.siteUrl, score: r.score, runAt: r.runAt });
    if (out.length >= limit) break;
  }
  return out;
}
