import { inngest } from "@/inngest/client";
import { db, sites, audits, subscriptions } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { runAudit } from "@/lib/seo-checker";
import { getSettings } from "@/db/settings";

type SeoCheck = {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  earned: number;
  points: number;
};
type AuditReport = { score: number; checks: SeoCheck[]; url: string };

/**
 * Weekly cron — fans out one `audit/run-scheduled` event per active
 * subscription. Mon 14:00 UTC = Mon 9am US/Eastern, before most operators
 * are in.
 */
export const weeklyAuditDispatcherFn = inngest.createFunction(
  { id: "weekly-audit-dispatcher", name: "Weekly audit dispatcher", retries: 1 },
  [{ cron: "0 14 * * 1" }, { event: "weekly-audit/manual" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused || settings.monitoringPaused) {
      return { skipped: true, reason: "paused" };
    }

    const activeSubs = await step.run("list-active-subscriptions", async () => {
      return db
        .select({ subId: subscriptions.id, siteId: subscriptions.siteId, email: subscriptions.customerEmail })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"));
    });

    logger.info(`Dispatching weekly audits for ${activeSubs.length} active subscriptions`);

    for (const s of activeSubs) {
      await step.sendEvent(`enqueue-${s.subId}`, {
        name: "audit/run-scheduled",
        data: { subscriptionId: s.subId, siteId: s.siteId },
      });
    }
    return { dispatched: activeSubs.length };
  },
);

/**
 * Per-subscription audit runner. Runs the audit, persists, and diffs
 * against the most recent prior audit for the same site. Emits
 * `audit/regressed` if any check went pass → warn/fail or score dropped
 * by 5+ points.
 */
export const weeklyAuditRunnerFn = inngest.createFunction(
  {
    id: "weekly-audit-runner",
    name: "Weekly audit runner",
    retries: 1,
    concurrency: { limit: 4 },
  },
  { event: "audit/run-scheduled" },
  async ({ event, step, logger }) => {
    const { subscriptionId, siteId } = event.data;

    const site = await step.run("load-site", async () => {
      const [row] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
      return row;
    });
    if (!site) {
      return { skipped: true, reason: "site missing" };
    }

    const previous = await step.run("load-previous-audit", async () => {
      const rows = await db
        .select()
        .from(audits)
        .where(and(eq(audits.siteId, siteId), eq(audits.status, "complete")))
        .orderBy(desc(audits.runAt))
        .limit(1);
      return rows[0] ?? null;
    });

    const [auditRow] = await step.run("create-audit-row", async () => {
      return db
        .insert(audits)
        .values({ siteId, status: "running" })
        .returning();
    });

    const result = await step.run("run-audit", async () => {
      try {
        return { ok: true as const, value: await runAudit(site.siteUrl) };
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        logger.error(`weekly audit failed for ${site.siteUrl}: ${msg}`);
        return { ok: false as const, error: msg.slice(0, 250) };
      }
    });

    if (!result.ok) {
      await step.run("mark-error", async () => {
        await db
          .update(audits)
          .set({ status: "error", errorMessage: result.error, runAt: new Date() })
          .where(eq(audits.id, auditRow.id));
      });
      return { failed: true, reason: result.error };
    }

    const value = result.value;

    await step.run("write-audit", async () => {
      const ttfb = value.checks.find((c) => c.id === "page_speed");
      const ttfbMs = ttfb ? Number(ttfb.detail.match(/(\d+)ms/)?.[1] ?? 0) : null;
      await db
        .update(audits)
        .set({
          status: "complete",
          score: value.score,
          ttfbMs,
          report: value,
          runAt: new Date(value.fetchedAt),
        })
        .where(eq(audits.id, auditRow.id));
      await db
        .update(sites)
        .set({ lastAuditAt: new Date(value.fetchedAt), updatedAt: new Date() })
        .where(eq(sites.id, siteId));
    });

    const regressions = previous?.report
      ? diffReports(previous.report as AuditReport, value as AuditReport)
      : { regressedChecks: [] as RegressionDelta[], scoreDelta: 0 };

    const shouldAlert =
      previous != null &&
      (regressions.regressedChecks.length > 0 || regressions.scoreDelta <= -5);

    if (shouldAlert) {
      await step.sendEvent("emit-regressed", {
        name: "audit/regressed",
        data: {
          subscriptionId,
          siteId,
          auditId: auditRow.id,
          previousAuditId: previous!.id,
          siteUrl: site.siteUrl,
          score: value.score,
          previousScore: previous!.score ?? value.score,
          scoreDelta: regressions.scoreDelta,
          regressedChecks: regressions.regressedChecks,
        },
      });
    }

    return {
      auditId: auditRow.id,
      score: value.score,
      regressedCount: regressions.regressedChecks.length,
      scoreDelta: regressions.scoreDelta,
      alertSent: shouldAlert,
    };
  },
);

type RegressionDelta = {
  id: string;
  name: string;
  prevStatus: SeoCheck["status"];
  newStatus: SeoCheck["status"];
  detail: string;
};

function diffReports(prev: AuditReport, next: AuditReport): {
  regressedChecks: RegressionDelta[];
  scoreDelta: number;
} {
  const prevById = new Map(prev.checks.map((c) => [c.id, c]));
  const regressedChecks: RegressionDelta[] = [];
  for (const n of next.checks) {
    const p = prevById.get(n.id);
    if (!p) continue;
    if (rankStatus(n.status) < rankStatus(p.status)) {
      regressedChecks.push({
        id: n.id,
        name: n.name,
        prevStatus: p.status,
        newStatus: n.status,
        detail: n.detail,
      });
    }
  }
  const scoreDelta = next.score - prev.score;
  return { regressedChecks, scoreDelta };
}

function rankStatus(s: SeoCheck["status"]): number {
  return s === "pass" ? 2 : s === "warn" ? 1 : 0;
}
