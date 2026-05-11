import { inngest } from "@/inngest/client";
import { db, outboundContacts, outboundContactMessages } from "@/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { sendContactMessage, findTemplate, applyTemplate } from "@/lib/sponsor-contacts";

/**
 * Daily sponsor outreach — auto-sends queued sponsor/partner/press
 * pitches at touch 0 → touch 1.
 *
 * Eligibility:
 *   status='queued'
 *   auto_send_enabled=true
 *   template_id set
 *   touch_number=0
 *
 * Each send applies the template against the contact's data, calls
 * sendContactMessage (which records into outbound_contact_messages and
 * flips status to 'sent'), and bumps touch_number to 1 + lastSendAt.
 *
 * Warmup curve: 3/day on day 0 → DAILY_CAP after WARMUP_DAYS. Smaller
 * audience than cold outreach (≈80 seed-discovered max), and the
 * deliverability cost of one complaint is much higher because sponsors
 * are influential.
 *
 * Two safety gates:
 *   1. SPONSOR_OUTREACH_ENABLED must be 'true' (defaults to 'false').
 *      Discovery alone produces a queue; sending is opt-in.
 *   2. Per-contact autoSendEnabled must be true.
 */
export const sponsorSendFn = inngest.createFunction(
  {
    id: "sponsor-send",
    name: "Sponsors — daily auto-send queue",
    retries: 1,
  },
  [{ cron: "30 15 * * *" }, { event: "sponsor/send" }],
  async ({ step, logger }) => {
    if (process.env.SPONSOR_OUTREACH_ENABLED !== "true") {
      return { skipped: true, reason: "SPONSOR_OUTREACH_ENABLED != true" };
    }

    const perRunCap = Number(process.env.SPONSOR_OUTREACH_PER_RUN_CAP ?? "10");
    const dailyCap = await step.run("compute-daily-cap", () => computeDailyCap());

    // Today's outbound sponsor sends.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [{ count: dailyUsedRaw }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboundContactMessages)
      .where(
        and(
          eq(outboundContactMessages.direction, "out"),
          eq(outboundContactMessages.status, "sent"),
          gte(outboundContactMessages.createdAt, todayStart),
        ),
      );
    const dailyUsed = Number(dailyUsedRaw ?? 0);
    const remaining = Math.max(0, dailyCap - dailyUsed);
    const thisRunBudget = Math.min(perRunCap, remaining);
    if (thisRunBudget <= 0) {
      return { skipped: true, reason: "daily cap reached", dailyUsed, dailyCap };
    }

    const eligible = await db
      .select()
      .from(outboundContacts)
      .where(
        and(
          eq(outboundContacts.status, "queued"),
          eq(outboundContacts.autoSendEnabled, true),
          eq(outboundContacts.touchNumber, 0),
          sql`${outboundContacts.templateId} IS NOT NULL AND ${outboundContacts.templateId} <> ''`,
        ),
      )
      .limit(thisRunBudget);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const c of eligible) {
      const tpl = c.templateId ? findTemplate(c.templateId) : undefined;
      if (!tpl) {
        skipped += 1;
        continue;
      }
      const applied = applyTemplate({ template: tpl, contact: c });
      const result = await sendContactMessage({
        contactId: c.id,
        subject: applied.subject,
        bodyText: applied.bodyText,
      });
      if (result.success) {
        await db
          .update(outboundContacts)
          .set({
            touchNumber: 1,
            lastSendAt: new Date(),
            status: "sent",
          })
          .where(eq(outboundContacts.id, c.id));
        sent += 1;
      } else {
        failed += 1;
        logger.warn(`sponsor-send contact ${c.id} failed: ${result.error}`);
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    return {
      eligible: eligible.length,
      sent,
      skipped,
      failed,
      dailyUsed: dailyUsed + sent,
      dailyCap,
    };
  },
);

async function computeDailyCap(): Promise<number> {
  const warmupStart = Number(process.env.SPONSOR_OUTREACH_WARMUP_START ?? "3");
  const dailyCap = Number(process.env.SPONSOR_OUTREACH_DAILY_CAP ?? "10");
  const warmupDays = Number(process.env.SPONSOR_OUTREACH_WARMUP_DAYS ?? "14");
  const envStart = process.env.SPONSOR_OUTREACH_WARMUP_STARTED;
  let startMs: number | null = null;
  if (envStart) {
    const t = new Date(envStart).getTime();
    if (!Number.isNaN(t)) startMs = t;
  }
  if (startMs == null) {
    const [{ first }] = await db
      .select({ first: sql<string | null>`min(${outboundContactMessages.createdAt})` })
      .from(outboundContactMessages)
      .where(eq(outboundContactMessages.direction, "out"));
    if (first) {
      const t = new Date(first).getTime();
      if (!Number.isNaN(t)) startMs = t;
    }
  }
  if (startMs == null) return warmupStart;
  const days = Math.floor((Date.now() - startMs) / 86_400_000);
  if (days >= warmupDays) return dailyCap;
  const stepUp = (dailyCap - warmupStart) / warmupDays;
  return Math.max(warmupStart, Math.round(warmupStart + stepUp * days));
}
