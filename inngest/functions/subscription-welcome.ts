import { inngest } from "@/inngest/client";
import { db, sites, audits } from "@/db";
import { eq, desc } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { env } from "@/lib/env";

function appUrl(): string {
  return env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
}
function senderDomain(): string {
  return env("SENDER_DOMAIN", "resend.dev")!;
}

/**
 * Welcome email sent the moment Stripe Checkout completes. Sets
 * expectations explicitly: weekly Monday re-checks, alerts only on
 * regression, replies welcomed. Stripe sends its own receipt so this
 * email focuses on what *we* do, not the transaction.
 *
 * Idempotency: the Resend `Idempotency-Key` header keys on the Stripe
 * subscription id, so webhook retries from Stripe (or duplicate
 * `subscription/started` events) result in at most one email.
 */
export const subscriptionWelcomeFn = inngest.createFunction(
  {
    id: "subscription-welcome",
    name: "Subscription welcome email",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "subscription/started" },
  async ({ event, step, logger }) => {
    const { subscriptionId, siteId, stripeSubscriptionId, customerEmail, plan } = event.data;

    const row = await step.run("load-site-and-latest-audit", async () => {
      const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
      if (!site) return null;
      const [latest] = await db
        .select({ id: audits.id, score: audits.score, status: audits.status })
        .from(audits)
        .where(eq(audits.siteId, siteId))
        .orderBy(desc(audits.createdAt))
        .limit(1);
      return { site, latest };
    });

    if (!row) {
      logger.warn(`site ${siteId} not found for subscription ${subscriptionId}`);
      return { skipped: true, reason: "site missing" };
    }

    const APP_URL = appUrl();
    const host = displayHost(row.site.siteUrl);
    const reportUrl = row.latest ? `${APP_URL}/audit/${row.latest.id}` : `${APP_URL}/audit/${siteId}`;
    const planLabel = plan === "seo-monitor-annual" ? "annual" : "monthly";

    const mjml = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="ui-sans-serif, -apple-system, system-ui, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f8fafc">
    <mj-section background-color="#ffffff" padding="32px 28px 8px">
      <mj-column>
        <mj-text font-size="13px" color="#10b981" font-weight="600" letter-spacing="1.5px" text-transform="uppercase">Sitebeat · subscription active</mj-text>
        <mj-text font-size="22px" font-weight="700" line-height="1.3" padding-top="6px" color="#0f172a">
          Monitoring is on for <a href="${reportUrl}" style="color:#0f172a;text-decoration:none">${escapeHtml(host)}</a>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 28px 12px">
      <mj-column>
        <mj-text font-size="14px" line-height="1.6" color="#0f172a">
          Thanks for subscribing. Here's exactly what to expect:
        </mj-text>

        <mj-text font-size="14px" line-height="1.6" color="#0f172a" padding-top="12px">
          <strong>1. Weekly checks every Monday at 14:00 UTC.</strong> We re-run the same 13-check audit you saw on your initial report.
        </mj-text>

        <mj-text font-size="14px" line-height="1.6" color="#0f172a" padding-top="6px">
          <strong>2. We email you only when something regresses.</strong> If a check goes from pass to warn/fail, or your score drops 5+ points, you'll get a one-screen email summarizing what changed. If nothing regresses, we don't send anything — silence means the site held steady.
        </mj-text>

        <mj-text font-size="14px" line-height="1.6" color="#0f172a" padding-top="6px">
          <strong>3. For anything else — questions, billing, cancellation — reply to this email.</strong> We read every reply and respond within 24 hours.
        </mj-text>

        <mj-text font-size="14px" line-height="1.6" color="#475569" padding-top="14px">
          Stripe will email you a separate receipt for the ${escapeHtml(planLabel)} plan. Your most recent audit is here:
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="4px 28px 16px">
      <mj-column>
        <mj-button href="${reportUrl}" background-color="#0f172a" color="#ffffff" font-size="14px" font-weight="600" padding="14px 24px" border-radius="8px" align="left">
          View your latest report →
        </mj-button>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="4px 28px 28px">
      <mj-column>
        <mj-text font-size="13px" color="#94a3b8" line-height="1.5">— Sitebeat</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

    const text =
      `Sitebeat — subscription active\n\n` +
      `Thanks for subscribing. Here's exactly what to expect:\n\n` +
      `1. Weekly checks every Monday at 14:00 UTC. We re-run the same 13-check audit you saw on your initial report.\n\n` +
      `2. We email you only when something regresses. If a check goes from pass to warn/fail, or your score drops 5+ points, you'll get a one-screen email summarizing what changed. If nothing regresses, we don't send anything — silence means the site held steady.\n\n` +
      `3. For anything else — questions, billing, cancellation — reply to this email. We read every reply and respond within 24 hours.\n\n` +
      `Stripe will email you a separate receipt for the ${planLabel} plan.\n\n` +
      `Your most recent audit: ${reportUrl}\n\n` +
      `— Sitebeat\n`;

    await step.run("send-welcome", async () => {
      return sendComplianceEmail({
        to: customerEmail,
        fromDomain: senderDomain(),
        fromName: "Sitebeat",
        subject: `You're subscribed to Sitebeat — first check Monday`,
        mjml,
        text,
        listingId: siteId,
        idempotencyKey: `subscription-welcome-${stripeSubscriptionId}`,
        tags: [
          { name: "kind", value: "subscription_welcome" },
          { name: "plan", value: plan === "seo-monitor-annual" ? "annual" : "monthly" },
        ],
      });
    });

    return { sent: true, to: customerEmail };
  },
);

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
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
