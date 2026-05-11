import { MetricCard } from "@/components/admin/metric-card";
import { Funnel } from "@/components/admin/funnel";
import { LiveFeed } from "@/components/admin/live-feed";
import { DeliverabilityPanel } from "@/components/admin/deliverability-panel";
import { PauseControls } from "@/components/admin/pause-controls";
import { ReadinessChecklist } from "@/components/admin/readiness-checklist";
import { ManualTrigger } from "@/components/admin/manual-trigger";
import {
  getFunnelMetrics,
  getDeliverabilityMetrics,
  getTodayAgentSpend,
  getIssuesMetrics,
  type FunnelMetrics,
  type DeliverabilityMetrics,
  type AgentSpendRow,
  type IssuesMetrics,
} from "@/lib/admin-metrics";
import { getSettings } from "@/db/settings";
import { formatCents } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminSettings } from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ZERO_FUNNEL: FunnelMetrics = {
  scrapedToday: 0,
  qualifiedToday: 0,
  previewsToday: 0,
  emailsSentToday: 0,
  emailsOpenedToday: 0,
  emailsClickedToday: 0,
  emailsRepliedToday: 0,
  emailsBouncedToday: 0,
  paidOrdersToday: 0,
  revenueCentsToday: 0,
  revenueCentsMtd: 0,
  openRate: 0,
  clickRate: 0,
  replyRate: 0,
  conversionRate: 0,
  // All-time totals (mirrored from Relist via lib/admin-metrics.ts).
  scrapedAllTime: 0,
  qualifiedAllTime: 0,
  previewsAllTime: 0,
  emailsSentAllTime: 0,
  emailsDeliveredAllTime: 0,
  emailsOpenedAllTime: 0,
  emailsClickedAllTime: 0,
  emailsRepliedAllTime: 0,
  emailsBouncedAllTime: 0,
  emailsComplainedAllTime: 0,
  emailsUnsubscribedAllTime: 0,
  uniqueRecipientsAllTime: 0,
  paidOrdersAllTime: 0,
  revenueCentsAllTime: 0,
  openRateAllTime: 0,
  clickRateAllTime: 0,
  replyRateAllTime: 0,
  bounceRateAllTime: 0,
  deliveryRateAllTime: 0,
};

const ZERO_DELIVERABILITY: DeliverabilityMetrics = {
  totalLast24h: 0,
  bounceRate: 0,
  complaintRate: 0,
  unsubscribeRate: 0,
  perDomain: [],
};

const ZERO_ISSUES: IssuesMetrics = {
  refundedOrdersToday: 0,
  failedOrdersToday: 0,
  fulfillingStuck: 0,
  unfulfilledPaidStuck: 0,
  highBounceDomains: [],
};

async function safe<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[admin] ${label} failed:`, e);
    return fallback;
  }
}

export default async function AdminDashboardPage() {
  // Run every query independently — a single failure shouldn't kill the page.
  const [metrics, deliverability, settingsRaw, spend, issues] = await Promise.all([
    safe(getFunnelMetrics, ZERO_FUNNEL, "getFunnelMetrics"),
    safe(getDeliverabilityMetrics, ZERO_DELIVERABILITY, "getDeliverabilityMetrics"),
    safe(getSettings, undefined as AdminSettings | undefined, "getSettings"),
    safe(getTodayAgentSpend, [] as AgentSpendRow[], "getTodayAgentSpend"),
    safe(getIssuesMetrics, ZERO_ISSUES, "getIssuesMetrics"),
  ]);

  // Settings is the only query that's structurally required by render — fall back to a
  // safe default object if it failed.
  const settings: AdminSettings = settingsRaw ?? ({
    id: 1,
    pricingStandardCents: 8900,
    pricingPremiumCents: 14900,
    pricingRushCents: 19900,
    dailySendCap: 500,
    previewDailyCap: 500,
    fulfillmentDailyBudgetCents: 100000,
    paused: false,
    discoveryPaused: false,
    qualificationPaused: false,
    previewPaused: false,
    outreachPaused: false,
    fulfillmentPaused: false,
    followupPaused: false,
    mailerEnabled: false,
    stylePresets: [],
    senderDomains: [],
    brokerageBlacklist: [],
    emailBlacklist: [],
    xRefreshToken: null,
    xUserId: null,
    xUsername: null,
    xMentionsSinceId: null,
    updatedAt: new Date(),
  } as AdminSettings);

  // Defensive: any nullable jsonb might come back as null in edge cases
  const senderDomainsSafe: string[] = Array.isArray(settings.senderDomains) ? settings.senderDomains : [];
  const settingsForChildren: AdminSettings = { ...settings, senderDomains: senderDomainsSafe };

  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const hasIssues =
    issues.refundedOrdersToday > 0 ||
    issues.failedOrdersToday > 0 ||
    issues.fulfillingStuck > 0 ||
    issues.unfulfilledPaidStuck > 0 ||
    issues.highBounceDomains.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live view of the last 24 hours. Page auto-revalidates on reload.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
        <MetricCard label="Scraped" value={metrics.scrapedToday} hint="today" />
        <MetricCard label="Qualified" value={metrics.qualifiedToday} hint="today" />
        <MetricCard label="Previews" value={metrics.previewsToday} hint="today" />
        <MetricCard label="Emails sent" value={metrics.emailsSentToday} hint="today" />
        <MetricCard label="Opens" value={metrics.emailsOpenedToday} hint={`${fmtPct(metrics.openRate)} open rate`} />
        <MetricCard label="Clicks" value={metrics.emailsClickedToday} hint={`${fmtPct(metrics.clickRate)} click rate`} />
        <MetricCard
          label="Paid orders"
          value={metrics.paidOrdersToday}
          tone="success"
          hint={`${fmtPct(metrics.conversionRate)} click→paid`}
        />
        <MetricCard
          label="Revenue"
          value={formatCents(metrics.revenueCentsToday)}
          hint={`MTD ${formatCents(metrics.revenueCentsMtd)}`}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Replies" value={metrics.emailsRepliedToday} hint={`${fmtPct(metrics.replyRate)} reply rate`} />
        <MetricCard
          label="Bounces"
          value={metrics.emailsBouncedToday}
          hint="today"
          tone={metrics.emailsBouncedToday > 5 ? "warning" : "default"}
        />
        <MetricCard
          label="Refunds"
          value={issues.refundedOrdersToday}
          hint="today"
          tone={issues.refundedOrdersToday > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Stuck fulfillment"
          value={issues.fulfillingStuck}
          hint="paid >2h, still running"
          tone={issues.fulfillingStuck > 0 ? "danger" : "default"}
        />
      </div>

      {hasIssues && (
        <Card className="border-amber-500/60 bg-amber-50/60">
          <CardHeader>
            <CardTitle>⚠️ Issues needing attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {issues.refundedOrdersToday > 0 && (
              <div>
                <b>{issues.refundedOrdersToday}</b> refunded order(s) today.
              </div>
            )}
            {issues.failedOrdersToday > 0 && (
              <div>
                <b>{issues.failedOrdersToday}</b> order(s) marked failed today.
              </div>
            )}
            {issues.fulfillingStuck > 0 && (
              <div>
                <b>{issues.fulfillingStuck}</b> order(s) stuck in "fulfilling" {">"}2h. SLA breached.
              </div>
            )}
            {issues.unfulfilledPaidStuck > 0 && (
              <div>
                <b>{issues.unfulfilledPaidStuck}</b> paid order(s) {">"}2h never started fulfilling.
              </div>
            )}
            {issues.highBounceDomains.length > 0 && (
              <div>
                High-bounce sender domains (&gt;5% in last 24h):{" "}
                <code>{issues.highBounceDomains.join(", ")}</code>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Funnel
          stages={[
            { label: "Scraped", count: metrics.scrapedToday },
            { label: "Qualified", count: metrics.qualifiedToday },
            { label: "Previewed", count: metrics.previewsToday },
            { label: "Emailed", count: metrics.emailsSentToday },
            { label: "Opened", count: metrics.emailsOpenedToday },
            { label: "Clicked", count: metrics.emailsClickedToday },
            { label: "Paid", count: metrics.paidOrdersToday },
          ]}
        />
        <DeliverabilityPanel metrics={deliverability} />
        <LiveFeed />
      </div>

      <ReadinessChecklist settings={settingsForChildren} />

      <ManualTrigger />

      <div className="grid gap-6 lg:grid-cols-2">
        <PauseControls settings={settingsForChildren} />
        <Card>
          <CardHeader>
            <CardTitle>Agent spend today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {spend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spend recorded yet.</p>
            ) : (
              spend.map((s) => (
                <div key={s.agent} className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{s.agent}</span>
                  <span className="tabular-nums">{formatCents(s.todayCents)}</span>
                </div>
              ))
            )}
            <div className="pt-3 text-xs text-muted-foreground">
              Auto-alert when spend hits 80% of daily budget
              ({formatCents(settings.fulfillmentDailyBudgetCents)}).
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
