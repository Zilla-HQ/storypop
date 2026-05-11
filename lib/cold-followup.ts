import { db, sites, audits, subscriptions, inboundEmails } from "@/db";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { stripe } from "@/lib/stripe";
import { letterGrade } from "@/lib/grade";
import {
  followupSubject,
  followupText,
  followupMjml,
  FOLLOWUP_TAG,
  type FollowupStage,
  type FollowupVars,
} from "@/lib/cold-followup-templates";
import { env } from "@/lib/env";

/**
 * Multi-touch cold-outbound follow-up engine.
 *
 * Determines which leads are due for which follow-up based on the age
 * of their most recent audit, gates on subscriptions / replies /
 * already-sent stages, and sends.
 *
 * Stage windows:
 *   - DAY2  : 1–3 days after audit (soft nudge)
 *   - DAY5  : 4–7 days after audit (discount via FIRST50 promo code)
 *   - DAY10 : 8–30 days after audit (break-up email)
 *
 * Older than 30 days: skipped (those leads are stale, not worth
 * re-engaging).
 *
 * Idempotent: each stage's tag is checked against inbound_emails to
 * avoid duplicate sends. Re-running the sweep is safe.
 */

export interface SweepResult {
  totalCandidates: number;
  sent: { day2: number; day5: number; day10: number };
  skipped: { hasSub: number; hasReply: number; alreadySentStage: number; tooOld: number; noRecipient: number };
  errors: number;
}

const SHARED_PROMO_CODE = "FIRST50";

/**
 * Ensure the shared FIRST50 promo code exists in Stripe. Idempotent —
 * checks first, only creates if missing. Called once on each sweep run.
 */
export async function ensureSharedPromoCode(): Promise<{ id: string; code: string }> {
  const existing = await stripe.promotionCodes.list({
    code: SHARED_PROMO_CODE,
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    return { id: existing.data[0].id, code: SHARED_PROMO_CODE };
  }

  // Create coupon (50% off first month)
  const coupon = await stripe.coupons.create({
    percent_off: 50,
    duration: "once",
    name: "First month — 50% off (cold outbound)",
    metadata: { campaign: "cold_outbound_followup_day5" },
  });

  // Create promo code with no expiry; cap redemptions for safety.
  // We'll rely on email copy + inactivation later if needed.
  const promo = await stripe.promotionCodes.create({
    code: SHARED_PROMO_CODE,
    coupon: coupon.id,
    max_redemptions: 200,
    active: true,
  });

  return { id: promo.id, code: SHARED_PROMO_CODE };
}

interface Candidate {
  siteId: string;
  siteUrl: string;
  customerEmail: string;
  auditId: string;
  auditRunAt: Date;
  score: number;
  failingCount: number;
  warningCount: number;
  daysSinceAudit: number;
}

/**
 * Pull every site that:
 *   - has a customer_email
 *   - has at least one completed audit with run_at
 *   - last audit is between 1 and 30 days old
 *   - has no active/trialing subscription
 *   - has no inbound reply from the customer_email
 *
 * Returns enriched candidates for the sweep loop.
 */
async function findFollowupCandidates(): Promise<Candidate[]> {
  // Find every site with completed audit + email + no subscription + no reply
  const rows = await db.execute<{
    site_id: string;
    site_url: string;
    customer_email: string;
    audit_id: string;
    run_at: Date;
    score: number;
    report: unknown;
  }>(sql`
    SELECT DISTINCT ON (s.id)
      s.id AS site_id,
      s.site_url,
      s.customer_email,
      a.id AS audit_id,
      a.run_at,
      a.score,
      a.report
    FROM sitebeat.sites s
    INNER JOIN sitebeat.audits a ON a.site_id = s.id
    WHERE s.customer_email IS NOT NULL
      AND s.customer_email <> ''
      AND a.status = 'complete'
      AND a.run_at IS NOT NULL
      AND a.run_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM sitebeat.subscriptions sub
        WHERE sub.site_id = s.id
          AND sub.status IN ('active', 'trialing')
      )
      AND NOT EXISTS (
        SELECT 1 FROM sitebeat.inbound_emails ie
        WHERE ie.direction = 'inbound'
          AND lower(ie.from_address) = lower(s.customer_email)
      )
    ORDER BY s.id, a.run_at DESC
  `);

  const list = (rows as unknown as { rows?: typeof rows }).rows ?? rows;
  const candidates: Candidate[] = [];
  for (const r of list as Array<typeof rows[number]>) {
    const checks = (r.report as { checks?: { status: string }[] } | null)?.checks ?? [];
    const failingCount = checks.filter((c) => c.status === "fail").length;
    const warningCount = checks.filter((c) => c.status === "warn").length;
    const days = Math.floor(
      (Date.now() - new Date(r.run_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    candidates.push({
      siteId: r.site_id,
      siteUrl: r.site_url,
      customerEmail: r.customer_email,
      auditId: r.audit_id,
      auditRunAt: r.run_at,
      score: r.score,
      failingCount,
      warningCount,
      daysSinceAudit: days,
    });
  }
  return candidates;
}

function stageForDays(days: number): FollowupStage | null {
  if (days >= 1 && days <= 3) return "day2";
  if (days >= 4 && days <= 7) return "day5";
  if (days >= 8 && days <= 30) return "day10";
  return null;
}

/**
 * Has this lead already received THIS specific stage's follow-up?
 * Checked against inbound_emails (direction=outbound, tag=stage_tag).
 */
async function alreadySentStage(
  customerEmail: string,
  stage: FollowupStage,
): Promise<boolean> {
  const tag = FOLLOWUP_TAG[stage];
  const rows = await db
    .select({ id: inboundEmails.id })
    .from(inboundEmails)
    .where(
      and(
        eq(inboundEmails.direction, "outbound"),
        eq(sql`lower(${inboundEmails.toAddress})`, customerEmail.toLowerCase()),
        eq(inboundEmails.tag, tag),
      )!,
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Send the follow-up for a given candidate at a given stage.
 * Threading: matches In-Reply-To against the original audit-report
 * email's message_id if we can find one (inbound_emails outbound row
 * with tag=audit_report). Falls back to no threading for old leads
 * whose original send predates the outbound-logging change.
 */
async function sendFollowupEmail(
  c: Candidate,
  stage: FollowupStage,
  promoCode: string,
): Promise<void> {
  const auditUrl = `${appUrl()}/audit/${c.auditId}`;
  const grade = letterGrade(c.score);

  const vars: FollowupVars = {
    domain: domainFromUrl(c.siteUrl),
    letterGrade: grade,
    score: c.score,
    failingCount: c.failingCount,
    warningCount: c.warningCount,
    auditUrl,
    promoCode,
  };

  // Try to thread against the original audit-report email if it's in
  // our outbound log.
  const priorRows = await db
    .select({ messageId: inboundEmails.messageId })
    .from(inboundEmails)
    .where(
      and(
        eq(inboundEmails.direction, "outbound"),
        eq(sql`lower(${inboundEmails.toAddress})`, c.customerEmail.toLowerCase()),
        eq(inboundEmails.tag, "audit_report"),
      )!,
    )
    .limit(1);
  const inReplyTo = priorRows[0]?.messageId ?? undefined;

  await sendComplianceEmail({
    to: c.customerEmail,
    fromDomain: senderDomain(),
    fromName: "Sitebeat",
    subject: followupSubject(stage, vars),
    text: followupText(stage, vars),
    mjml: followupMjml(stage, vars),
    inReplyTo: inReplyTo ?? undefined,
    references: inReplyTo ?? undefined,
    listingId: c.siteId,
    tags: [
      { name: "kind", value: FOLLOWUP_TAG[stage] },
      { name: "channel", value: "cold_outbound" },
      { name: "stage", value: stage },
    ],
    idempotencyKey: `${FOLLOWUP_TAG[stage]}_${c.siteId}`,
  });
}

export async function runFollowupSweep(): Promise<SweepResult> {
  const result: SweepResult = {
    totalCandidates: 0,
    sent: { day2: 0, day5: 0, day10: 0 },
    skipped: { hasSub: 0, hasReply: 0, alreadySentStage: 0, tooOld: 0, noRecipient: 0 },
    errors: 0,
  };

  // Ensure shared promo exists before we start firing day-5 emails.
  let promoCode = SHARED_PROMO_CODE;
  try {
    const promo = await ensureSharedPromoCode();
    promoCode = promo.code;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[followup] could not ensure FIRST50 promo:", (err as Error).message);
  }

  const candidates = await findFollowupCandidates();
  result.totalCandidates = candidates.length;

  for (const c of candidates) {
    const stage = stageForDays(c.daysSinceAudit);
    if (!stage) {
      result.skipped.tooOld += 1;
      continue;
    }
    try {
      const sentBefore = await alreadySentStage(c.customerEmail, stage);
      if (sentBefore) {
        result.skipped.alreadySentStage += 1;
        continue;
      }
      await sendFollowupEmail(c, stage, promoCode);
      result.sent[stage] += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[followup] send failed for ${c.customerEmail} stage=${stage}:`,
        (err as Error).message,
      );
      result.errors += 1;
    }
  }

  return result;
}

function appUrl(): string {
  return env("NEXT_PUBLIC_APP_URL", "https://sitebeat.tech")!;
}

function senderDomain(): string {
  return env("SENDER_DOMAIN", "mail.sitebeat.tech")!;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
