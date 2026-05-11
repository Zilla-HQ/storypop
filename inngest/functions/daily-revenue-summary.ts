/**
 * Daily revenue + ad performance summary email — fires every morning
 * at 13:00 UTC (~9 AM ET) so the operator opens their inbox to a
 * single what-changed-yesterday digest instead of poking around
 * Meta Ads Manager + Stripe + Resend separately.
 *
 * Sections:
 *   1. Revenue: orders created / paid / fulfilled / refunded yesterday
 *   2. Funnel: grader runs / sample-email signups / IC firings
 *   3. Meta ads: spend by campaign + top creatives + alerts
 *   4. Outreach: emails sent + (if we had bounce tracking) bounces
 */
import { inngest } from "@/inngest/client";
import { db, orders, listings, messages } from "@/db";
import { and, eq, gte, lt, sql, isNotNull } from "drizzle-orm";
import { fetchMetaAdsSnapshot } from "@/lib/meta-ads";
import { Resend } from "resend";
import { env } from "@/lib/env";

const RESEND_KEY = env("RESEND_API_KEY");
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const OPERATOR_EMAIL = env("OPERATOR_EMAIL", env("REPLIES_EMAIL", "jack@seifdn.org"))!;
const ADMIN_EMAIL = env("ADMIN_EMAIL", OPERATOR_EMAIL)!;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");

function fmtUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const dailyRevenueSummaryFn = inngest.createFunction(
  {
    id: "daily-revenue-summary",
    name: "Daily revenue + ad performance summary",
    concurrency: { limit: 1 },
  },
  { cron: "0 13 * * *" },
  async ({ step, logger }) => {
    if (!resend) {
      logger.warn("[daily-summary] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterday = new Date(today.getTime() - 86400_000);
    const yesterdaySlug = yesterday.toISOString().slice(0, 10);

    // ─── 1. Revenue ─────────────────────────────────────────────────────
    const orderStats = await step.run("orders", async () => {
      const rows = await db
        .select({
          status: orders.status,
          n: sql<number>`count(*)::int`,
          cents: sql<number>`coalesce(sum(amount_cents), 0)::int`,
        })
        .from(orders)
        .where(and(gte(orders.createdAt, yesterday), lt(orders.createdAt, today)))
        .groupBy(orders.status);
      return rows;
    });

    // ─── 2. Funnel ──────────────────────────────────────────────────────
    const funnel = await step.run("funnel", async () => {
      const [graderListings] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(listings)
        .where(and(gte(listings.createdAt, yesterday), lt(listings.createdAt, today)));
      const [withEmail] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(listings)
        .where(
          and(
            gte(listings.createdAt, yesterday),
            lt(listings.createdAt, today),
            isNotNull(listings.selfServeEmail),
          ),
        );
      return {
        listings: graderListings?.n ?? 0,
        sampleEmailSignups: withEmail?.n ?? 0,
      };
    });

    // ─── 3. Meta ads ────────────────────────────────────────────────────
    const meta = await step.run("meta-ads", async () => {
      try {
        const snap = await fetchMetaAdsSnapshot();
        return snap;
      } catch (err) {
        logger.warn(`[daily-summary] meta snapshot failed: ${err}`);
        return null;
      }
    });

    // ─── 4. Outreach ────────────────────────────────────────────────────
    const outreach = await step.run("outreach", async () => {
      const [outbound] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.direction, "outbound"),
            gte(messages.createdAt, yesterday),
            lt(messages.createdAt, today),
          ),
        );
      const [inbound] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.direction, "inbound"),
            gte(messages.createdAt, yesterday),
            lt(messages.createdAt, today),
          ),
        );
      return {
        outboundCount: outbound?.n ?? 0,
        inboundCount: inbound?.n ?? 0,
      };
    });

    // ─── Build the email ────────────────────────────────────────────────
    const subject = `Restay daily — ${yesterdaySlug}`;

    let revenueLine = "(no orders yesterday)";
    const paid = orderStats.find((o) => o.status === "paid");
    const pending = orderStats.find((o) => o.status === "pending");
    const refunded = orderStats.find((o) => o.status === "refunded");
    const failed = orderStats.find((o) => o.status === "failed");
    if (orderStats.length > 0) {
      const parts: string[] = [];
      if (paid) parts.push(`${paid.n} paid (${fmtUSD(paid.cents)})`);
      if (pending) parts.push(`${pending.n} pending`);
      if (refunded) parts.push(`${refunded.n} refunded`);
      if (failed) parts.push(`${failed.n} failed`);
      revenueLine = parts.join(" / ");
    }

    let metaLines = "(meta snapshot unavailable)";
    if (meta) {
      const ranked = [...meta.campaigns].sort((a, b) => b.spendCents - a.spendCents);
      metaLines = ranked
        .map((c) => {
          const cplpv = c.landingPageViews > 0 ? fmtUSD(c.spendCents / c.landingPageViews) : "—";
          return `  · ${c.name}\n     spend=${fmtUSD(c.spendCents)}  CTR=${(c.ctr * 100).toFixed(2)}%  CPC=${fmtUSD(c.cpcCents)}  LPV=${c.landingPageViews}  CPLPV=${cplpv}`;
        })
        .join("\n");
    }

    const text = `Restay — daily summary for ${yesterdaySlug}

REVENUE (yesterday)
  ${revenueLine}

FUNNEL (yesterday)
  Listings created (grader runs): ${funnel.listings}
  Sample-email signups:           ${funnel.sampleEmailSignups}

META ADS (lifetime)
${metaLines}
  Total: ${meta ? fmtUSD(meta.totalSpendCents) : "?"}

OUTREACH (yesterday)
  Outbound:  ${outreach.outboundCount}
  Inbound:   ${outreach.inboundCount}

Admin:  ${APP_URL}/admin
`;

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 16px;font-size:18px;">Restay — daily summary <span style="color:#64748b;font-weight:400;">${yesterdaySlug}</span></h2>

<table style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;background:#f8fafc;width:100%;margin:8px 0 16px;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;margin-bottom:6px;">Revenue (yesterday)</div>
<div style="font-size:18px;font-weight:700;color:${paid ? "#059669" : "#0f172a"};">${revenueLine}</div>
</td></tr>
</table>

<table style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;width:100%;margin:8px 0 16px;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;margin-bottom:6px;">Funnel (yesterday)</div>
<div>Listings created (grader runs): <strong>${funnel.listings}</strong></div>
<div>Sample-email signups: <strong>${funnel.sampleEmailSignups}</strong></div>
</td></tr>
</table>

<table style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;width:100%;margin:8px 0 16px;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;margin-bottom:6px;">Meta ads (lifetime)</div>
<pre style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;font-size:12px;white-space:pre-wrap;margin:0;">${metaLines}</pre>
<div style="margin-top:8px;font-size:13px;">Total: <strong>${meta ? fmtUSD(meta.totalSpendCents) : "?"}</strong></div>
</td></tr>
</table>

<table style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;width:100%;margin:8px 0 16px;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;margin-bottom:6px;">Outreach (yesterday)</div>
<div>Outbound: <strong>${outreach.outboundCount}</strong></div>
<div>Inbound: <strong>${outreach.inboundCount}</strong></div>
</td></tr>
</table>

<p style="font-size:12px;color:#64748b;">Admin: <a href="${APP_URL}/admin" style="color:#475569;">${APP_URL.replace(/^https?:\/\//, "")}/admin</a></p>
</body></html>`;

    const result = await step.run("send-email", async () => {
      return await resend!.emails.send({
        from: `Restay Daily <ops@${FROM_DOMAIN}>`,
        to: [OPERATOR_EMAIL, ADMIN_EMAIL].filter((e, i, arr) => arr.indexOf(e) === i),
        subject,
        text,
        html,
        tags: [
          { name: "type", value: "daily_summary" },
          { name: "date", value: yesterdaySlug },
        ],
      });
    });

    return {
      yesterdaySlug,
      revenue: revenueLine,
      sentTo: OPERATOR_EMAIL,
      resendId: result.data?.id ?? null,
    };
  },
);
