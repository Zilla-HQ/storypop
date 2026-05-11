import { inngest } from "@/inngest/client";
import { db, sites, audits } from "@/db";
import { eq } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { env } from "@/lib/env";
import { letterGrade, gradeColor, gradeNarrative } from "@/lib/grade";
import { recommendationFor } from "@/lib/check-recommendations";

// Read at call-time, not at module instantiation — Vercel sometimes warm-
// starts a function instance against an older deploy snapshot, and a
// module-level read pinned APP_URL to "http://localhost:3000" in cached
// instances even after we set NEXT_PUBLIC_APP_URL=https://sitebeat.tech.
function appUrl(): string {
  return env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
}
function senderDomain(): string {
  return env("SENDER_DOMAIN", "resend.dev")!;
}

type SeoCheck = {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  earned: number;
  points: number;
};

type AuditReport = {
  score: number;
  checks: SeoCheck[];
  url: string;
};

/**
 * After every audit/complete event, if the submitted site has a customer
 * email attached, deliver the report by email and pitch the weekly
 * monitoring subscription. Idempotent on (auditId).
 */
export const auditReportEmailFn = inngest.createFunction(
  {
    id: "audit-report-email",
    name: "Audit report email",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "audit/complete" },
  async ({ event, step, logger }) => {
    const { siteId, auditId } = event.data;

    const row = await step.run("load-site-and-audit", async () => {
      const rows = await db
        .select({ site: sites, audit: audits })
        .from(audits)
        .innerJoin(sites, eq(sites.id, audits.siteId))
        .where(eq(audits.id, auditId))
        .limit(1);
      return rows[0];
    });

    if (!row) {
      logger.warn(`audit ${auditId} not found`);
      return { skipped: true, reason: "audit not found" };
    }
    if (!row.site.customerEmail) {
      return { skipped: true, reason: "no customer email — nothing to send" };
    }
    if (!row.audit.report) {
      return { skipped: true, reason: "report missing on audit row" };
    }

    const report = row.audit.report as AuditReport;
    const APP_URL = appUrl();
    const reportUrl = `${APP_URL}/audit/${auditId}`;
    // One-click → Stripe Checkout. Falls back to /pricing if the redirect fails.
    const subscribeMonthlyUrl = `${APP_URL}/subscribe?siteId=${siteId}&plan=monthly`;
    const subscribeAnnualUrl = `${APP_URL}/subscribe?siteId=${siteId}&plan=annual`;

    const grouped = groupChecks(report.checks);
    const pillByStatus: Record<"pass" | "warn" | "fail", string> = {
      pass: "#10b981",
      warn: "#f59e0b",
      fail: "#ef4444",
    };

    const grade = letterGrade(report.score);
    const gradeBg = gradeColor(grade);
    const gradeBlurb = gradeNarrative(grade);

    // Failing/warning checks first, with the "how to fix" recommendation
    // inline so the email itself shows actionable value (not just a list
    // of problems).
    const issues = report.checks.filter((c) => c.status !== "pass");
    const passes = report.checks.filter((c) => c.status === "pass");

    const issuesMjml = issues
      .map((c) => {
        const rec = recommendationFor(c.id);
        const fixBlock = rec
          ? `<mj-text font-size="13px" color="#475569" padding="4px 0 0 16px" line-height="1.5">
                  <em style="color:#94a3b8">Fix:</em> ${escapeHtml(rec.fix)}
                </mj-text>`
          : "";
        return `
      <mj-text padding="10px 0 4px" font-size="14px" line-height="1.4">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${pillByStatus[c.status]};margin-right:8px;vertical-align:middle"></span>
        <strong>${escapeHtml(c.name)}</strong>
        <span style="color:#64748b"> — ${escapeHtml(c.detail)}</span>
      </mj-text>
      ${fixBlock}`;
      })
      .join("");

    const passesMjml = passes
      .map(
        (c) => `
      <mj-text padding="4px 0" font-size="13px" color="#64748b" line-height="1.4">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${pillByStatus.pass};margin-right:8px;vertical-align:middle"></span>
        ${escapeHtml(c.name)}
      </mj-text>`,
      )
      .join("");

    const mjml = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="ui-sans-serif, -apple-system, system-ui, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f8fafc">
    <mj-section background-color="#ffffff" padding="32px 24px 4px">
      <mj-group>
        <mj-column width="32%" vertical-align="middle">
          <mj-text align="center" padding="0">
            <div style="display:inline-block;background:${gradeBg};color:#ffffff;border-radius:18px;width:100px;height:100px;line-height:100px;font-size:48px;font-weight:800;text-align:center;">${grade}</div>
          </mj-text>
        </mj-column>
        <mj-column width="68%">
          <mj-text font-size="13px" color="${gradeBg}" font-weight="600" letter-spacing="2px" text-transform="uppercase">Sitebeat audit · ${report.score}/100</mj-text>
          <mj-text font-size="22px" font-weight="700" line-height="1.2">${escapeHtml(displayHost(report.url))} got a ${grade}</mj-text>
          <mj-text font-size="14px" color="#475569" line-height="1.5" padding-top="4px">${escapeHtml(gradeBlurb)}</mj-text>
          <mj-text font-size="12px" color="#94a3b8" padding-top="6px">
            ${grouped.pass} passing · ${grouped.warn} warnings · ${grouped.fail} failing
          </mj-text>
        </mj-column>
      </mj-group>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 24px 8px">
      <mj-column>
        <mj-text font-size="14px" color="#475569" padding-bottom="8px" line-height="1.5">
          We re-crawl every Monday and email only when something regresses. <strong>One click below = subscribed.</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ecfdf5" padding="12px 24px" border-radius="8px">
      <mj-column>
        <mj-text font-size="14px" color="#065f46" font-weight="600" align="center" line-height="1.4">
          ✓ Free for 14 days. No charge today. Cancel any time before day 15.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="8px 24px 8px">
      <mj-column width="50%">
        <mj-button href="${subscribeMonthlyUrl}" background-color="#10b981" color="#ffffff" font-size="14px" font-weight="600" padding="14px 8px" border-radius="8px" width="100%">
          Start free 14-day trial →
        </mj-button>
      </mj-column>
      <mj-column width="50%">
        <mj-button href="${subscribeAnnualUrl}" background-color="#0f172a" color="#ffffff" font-size="14px" font-weight="600" padding="14px 8px" border-radius="8px" width="100%">
          $290 / year (save 17%) →
        </mj-button>
      </mj-column>
    </mj-section>

    ${
      issues.length > 0
        ? `<mj-section background-color="#ffffff" padding="16px 24px 8px">
      <mj-column>
        <mj-text font-size="13px" color="#94a3b8" font-weight="600" letter-spacing="1.5px" text-transform="uppercase" padding-bottom="4px">
          ${issues.length} issue${issues.length === 1 ? "" : "s"} hurting your rankings
        </mj-text>
        ${issuesMjml}
      </mj-column>
    </mj-section>`
        : ""
    }
    ${
      passes.length > 0
        ? `<mj-section background-color="#ffffff" padding="8px 24px 8px">
      <mj-column>
        <mj-text font-size="13px" color="#94a3b8" font-weight="600" letter-spacing="1.5px" text-transform="uppercase" padding-bottom="4px">
          ${passes.length} passing
        </mj-text>
        ${passesMjml}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="#ffffff" padding="0 24px 28px">
      <mj-column>
        <mj-text font-size="13px" color="#64748b" align="center">
          <a href="${reportUrl}" style="color:#10b981;">View the live report →</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

    const text =
      `Sitebeat — your SEO audit is ready.\n\n` +
      `URL: ${report.url}\n` +
      `Score: ${report.score}/100  (${grouped.pass} passed, ${grouped.warn} warnings, ${grouped.fail} failed)\n\n` +
      report.checks
        .map((c) => `${c.status === "pass" ? "✓" : c.status === "warn" ? "⚠" : "✗"} ${c.name} — ${c.detail}`)
        .join("\n") +
      `\n\nFull report: ${reportUrl}\n\n` +
      `✓ Free for 14 days. No charge today. Cancel before day 15 if not for you.\n\n` +
      `Start your free trial:\n` +
      `  Monthly ($29/mo after 14-day trial):  ${subscribeMonthlyUrl}\n` +
      `  Annual ($290, save 17%):              ${subscribeAnnualUrl}\n`;

    await step.run("send-email", async () => {
      return sendComplianceEmail({
        to: row.site.customerEmail!,
        fromDomain: senderDomain(),
        fromName: "Sitebeat",
        subject:
          issues.length > 0
            ? `${displayHost(report.url)} got a ${grade} — ${issues.length} SEO issue${issues.length === 1 ? "" : "s"} to fix`
            : `${displayHost(report.url)} got an ${grade} — your SEO is dialed in`,
        mjml,
        text,
        listingId: siteId,
        idempotencyKey: `audit-report-${auditId}`,
        tags: [
          { name: "kind", value: "audit_report" },
          { name: "score", value: String(report.score) },
        ],
      });
    });

    return { sent: true, to: row.site.customerEmail };
  },
);

function groupChecks(checks: SeoCheck[]): { pass: number; warn: number; fail: number } {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) counts[c.status]++;
  return counts;
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
