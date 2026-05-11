import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelMetrics } from "@/lib/admin-metrics";
import { formatCents } from "@/lib/utils";

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtNum = (n: number) => n.toLocaleString();

export function AllTimePanel({ metrics }: { metrics: FunnelMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All-time totals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          <Row label="Listings scraped" value={fmtNum(metrics.scrapedAllTime)} />
          <Row label="Qualified" value={fmtNum(metrics.qualifiedAllTime)} />
          <Row label="Previews generated" value={fmtNum(metrics.previewsAllTime)} />
          <Row label="Emails sent" value={fmtNum(metrics.emailsSentAllTime)} />
          <Row label="Delivered" value={`${fmtNum(metrics.emailsDeliveredAllTime)} (${fmtPct(metrics.deliveryRateAllTime)})`} />
          <Row label="Unique recipients" value={fmtNum(metrics.uniqueRecipientsAllTime)} />
          <Row label="Opens" value={`${fmtNum(metrics.emailsOpenedAllTime)} (${fmtPct(metrics.openRateAllTime)})`} />
          <Row label="Clicks" value={`${fmtNum(metrics.emailsClickedAllTime)} (${fmtPct(metrics.clickRateAllTime)})`} />
          <Row label="Replies" value={`${fmtNum(metrics.emailsRepliedAllTime)} (${fmtPct(metrics.replyRateAllTime)})`} />
          <Row label="Bounces" value={`${fmtNum(metrics.emailsBouncedAllTime)} (${fmtPct(metrics.bounceRateAllTime)})`} />
          <Row label="Complaints" value={fmtNum(metrics.emailsComplainedAllTime)} />
          <Row label="Unsubscribes" value={fmtNum(metrics.emailsUnsubscribedAllTime)} />
          <Row label="Paid orders" value={fmtNum(metrics.paidOrdersAllTime)} />
          <Row label="Revenue" value={formatCents(metrics.revenueCentsAllTime)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
