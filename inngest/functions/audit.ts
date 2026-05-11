import { inngest } from "@/inngest/client";
import { db, audits, sites } from "@/db";
import { eq } from "drizzle-orm";
import { runAudit } from "@/lib/seo-checker";
import { trackEvent } from "@/lib/posthog";

/**
 * SEO Audit runner — listens for `audit/run-requested`, runs the cheerio
 * audit pipeline, persists the result to the audits table, and emits
 * `audit/complete` for downstream emailers.
 *
 * Called from app/api/audit/route.ts (inbound homepage submit) and from
 * the (follow-up) weekly monitor cron.
 */
export const auditFn = inngest.createFunction(
  {
    id: "audit-run",
    name: "SEO audit runner",
    retries: 1,
    concurrency: { limit: 4 },
  },
  { event: "audit/run-requested" },
  async ({ event, step, logger }) => {
    const { siteId, auditId, siteUrl } = event.data;

    await step.run("mark-running", async () => {
      await db.update(audits).set({ status: "running" }).where(eq(audits.id, auditId));
    });

    const result = await step.run("run-audit", async () => {
      try {
        return { ok: true as const, value: await runAudit(siteUrl) };
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        logger.error(`audit failed for ${siteUrl}: ${msg}`);
        return { ok: false as const, error: msg.slice(0, 250) };
      }
    });

    if (!result.ok) {
      await step.run("mark-error", async () => {
        await db
          .update(audits)
          .set({ status: "error", errorMessage: result.error, runAt: new Date() })
          .where(eq(audits.id, auditId));
      });
      return { failed: true, reason: result.error };
    }

    const { value } = result;

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
        .where(eq(audits.id, auditId));
      await db
        .update(sites)
        .set({ lastAuditAt: new Date(value.fetchedAt), updatedAt: new Date() })
        .where(eq(sites.id, siteId));
    });

    await step.sendEvent("emit-complete", {
      name: "audit/complete",
      data: { siteId, auditId, siteUrl, score: value.score },
    });

    await trackEvent({
      distinctId: siteId,
      event: "audit_complete",
      properties: { score: value.score, site_url: siteUrl, check_count: value.checks.length },
    });

    return { auditId, score: value.score, checkCount: value.checks.length };
  },
);
