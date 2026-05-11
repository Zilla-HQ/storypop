import { inngest } from "@/inngest/client";
import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { env } from "@/lib/env";

// Read at call-time so warm function instances reflect current env vars.
function appUrl(): string {
  return env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
}
function senderDomain(): string {
  return env("SENDER_DOMAIN", "resend.dev")!;
}

/**
 * Email the subscriber a one-screen summary of what regressed since last
 * week's audit. Idempotent on (auditId).
 */
export const regressionAlertFn = inngest.createFunction(
  {
    id: "regression-alert",
    name: "Regression alert email",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "audit/regressed" },
  async ({ event, step, logger }) => {
    const { subscriptionId, siteId, auditId, siteUrl, score, previousScore, scoreDelta, regressedChecks } = event.data;

    const sub = await step.run("load-subscription", async () => {
      const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
      return row;
    });
    if (!sub) {
      logger.warn(`subscription ${subscriptionId} missing`);
      return { skipped: true, reason: "subscription missing" };
    }
    if (sub.status !== "active") {
      return { skipped: true, reason: `subscription not active (${sub.status})` };
    }

    const APP_URL = appUrl();
    const reportUrl = `${APP_URL}/audit/${auditId}`;
    const pillByStatus: Record<"pass" | "warn" | "fail", { color: string; label: string }> = {
      pass: { color: "#10b981", label: "PASS" },
      warn: { color: "#f59e0b", label: "WARN" },
      fail: { color: "#ef4444", label: "FAIL" },
    };

    const checksMjml = regressedChecks
      .map(
        (c) => `
      <mj-text padding="6px 0" font-size="14px" line-height="1.4">
        <strong>${escapeHtml(c.name)}</strong><br/>
        <span style="color:#64748b">${pillByStatus[c.prevStatus].label} → ${pillByStatus[c.newStatus].label}</span>
        <span style="color:#475569"> · ${escapeHtml(c.detail)}</span>
      </mj-text>`,
      )
      .join("");

    const arrow = scoreDelta < 0 ? "↓" : scoreDelta > 0 ? "↑" : "·";
    const deltaColor = scoreDelta < 0 ? "#ef4444" : "#10b981";

    const mjml = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="ui-sans-serif, -apple-system, system-ui, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f8fafc">
    <mj-section background-color="#ffffff" padding="32px 24px 8px">
      <mj-column>
        <mj-text font-size="13px" color="#ef4444" font-weight="600" letter-spacing="2px" text-transform="uppercase">SEO regression</mj-text>
        <mj-text font-size="24px" font-weight="700" line-height="1.3">
          ${regressedChecks.length} check${regressedChecks.length === 1 ? "" : "s"} regressed on ${escapeHtml(displayHost(siteUrl))}
        </mj-text>
        <mj-text font-size="15px" color="#475569">
          Score: <strong>${score}/100</strong>
          <span style="color:${deltaColor}"> ${arrow} ${Math.abs(scoreDelta)}</span>
          <span style="color:#94a3b8"> (was ${previousScore})</span>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 24px 16px">
      <mj-column>
        <mj-text font-size="13px" color="#64748b" font-weight="600" letter-spacing="1px" text-transform="uppercase" padding-bottom="6px">What changed</mj-text>
        ${checksMjml}
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="8px 24px 28px">
      <mj-column>
        <mj-button href="${reportUrl}" background-color="#0f172a" color="#ffffff" font-size="14px" font-weight="600" padding="14px 32px" border-radius="8px">
          See the full audit →
        </mj-button>
        <mj-text font-size="13px" color="#64748b" align="center" padding-top="14px">
          We'll re-check next Monday. You'll only hear from us when something changes.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

    const text =
      `Sitebeat — SEO regression detected on ${displayHost(siteUrl)}\n\n` +
      `Score: ${score}/100  ${arrow} ${Math.abs(scoreDelta)}  (was ${previousScore})\n\n` +
      `What changed:\n` +
      regressedChecks.map((c) => `  • ${c.name}: ${c.prevStatus.toUpperCase()} → ${c.newStatus.toUpperCase()} — ${c.detail}`).join("\n") +
      `\n\nFull audit: ${reportUrl}\n`;

    await step.run("send-email", async () => {
      return sendComplianceEmail({
        to: sub.customerEmail,
        fromDomain: senderDomain(),
        fromName: "Sitebeat",
        subject: `${regressedChecks.length} SEO check${regressedChecks.length === 1 ? "" : "s"} regressed on ${displayHost(siteUrl)}`,
        mjml,
        text,
        listingId: siteId,
        idempotencyKey: `regression-alert-${auditId}`,
        tags: [
          { name: "kind", value: "regression_alert" },
          { name: "regressed_count", value: String(regressedChecks.length) },
        ],
      });
    });

    return { sent: true, to: sub.customerEmail, regressedCount: regressedChecks.length };
  },
);

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
