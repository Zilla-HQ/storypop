import { NextRequest, NextResponse } from "next/server";
import { db, sites, audits } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { findCompanyEmail } from "@/lib/find-company-email";
import { hasMxRecord } from "@/lib/validate-email";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cold outreach trigger. POST a list of site URLs and we'll:
 *   1. Try to extract a contact email from each site
 *   2. Upsert a `sites` row with that email
 *   3. Create an `audits` row + fire `audit/run-requested`
 *   4. The existing pipeline (auditFn → audit/complete →
 *      auditReportEmailFn) emails the report with subscribe CTAs.
 *
 * Auth: shared-secret in `Authorization: Bearer <OUTREACH_SECRET>`.
 *
 * Body: { urls: string[], dryRun?: boolean }
 *   - dryRun: don't enqueue audits, just report what would happen
 *
 * Response: { results: [{ url, email|null, siteId|null, auditId|null, skipped }] }
 *
 * Skipped reasons: "no_email", "invalid_url", "duplicate_recent" (already
 * audited within last 24h with same email, won't re-spam).
 */

const OUTREACH_SECRET = process.env.OUTREACH_SECRET;

interface OutreachResult {
  url: string;
  email: string | null;
  siteId: string | null;
  auditId: string | null;
  skipped?: "no_email" | "no_mx" | "invalid_url" | "duplicate_recent";
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!OUTREACH_SECRET) {
    return NextResponse.json(
      { error: "OUTREACH_SECRET env var not set; outreach endpoint disabled" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  if (provided !== OUTREACH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { urls?: unknown; dryRun?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.urls)) {
    return NextResponse.json({ error: "urls must be an array of strings" }, { status: 400 });
  }
  const dryRun = Boolean(body.dryRun);

  const results: OutreachResult[] = [];
  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

  for (const raw of body.urls.slice(0, 100)) {
    if (typeof raw !== "string") continue;
    const url = normalizeUrl(raw);
    if (!url) {
      results.push({ url: String(raw), email: null, siteId: null, auditId: null, skipped: "invalid_url" });
      continue;
    }

    const email = await findCompanyEmail(url);
    if (!email) {
      results.push({ url, email: null, siteId: null, auditId: null, skipped: "no_email" });
      continue;
    }

    // MX pre-flight — skip addresses on domains that don't accept mail.
    // Cuts ~80% of "domain not found" bounces from cold outreach. Resend
    // throttles senders above ~5% bounce rate.
    if (!(await hasMxRecord(email))) {
      results.push({ url, email, siteId: null, auditId: null, skipped: "no_mx" });
      continue;
    }

    if (dryRun) {
      results.push({ url, email, siteId: null, auditId: null });
      continue;
    }

    // Upsert site row keyed on URL.
    const [existing] = await db.select().from(sites).where(eq(sites.siteUrl, url)).limit(1);
    const siteRow = existing
      ? (
          await db
            .update(sites)
            .set({ customerEmail: email, updatedAt: new Date() })
            .where(eq(sites.id, existing.id))
            .returning()
        )[0]
      : (
          await db.insert(sites).values({ siteUrl: url, customerEmail: email }).returning()
        )[0];

    // Don't re-spam: skip if we already audited and emailed this site in the last 24h.
    if (existing?.lastAuditAt && Date.now() - existing.lastAuditAt.getTime() < TWENTY_FOUR_H) {
      results.push({ url, email, siteId: siteRow.id, auditId: null, skipped: "duplicate_recent" });
      continue;
    }

    const [auditRow] = await db
      .insert(audits)
      .values({ siteId: siteRow.id, status: "pending" })
      .returning();

    try {
      await inngest.send({
        name: "audit/run-requested",
        data: { siteId: siteRow.id, auditId: auditRow.id, siteUrl: url },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("inngest.send failed for outreach:", (err as Error).message);
    }

    results.push({ url, email, siteId: siteRow.id, auditId: auditRow.id });
  }

  return NextResponse.json({
    queued: results.filter((r) => r.auditId).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  });
}
