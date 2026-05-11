import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdsInsights } from "@/lib/meta-ads";
import { formatCents } from "@/lib/utils";

const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;
const fmtNum = (n: number) => n.toLocaleString();
const fmtDollars = (n: number) => `$${n.toFixed(2)}`;

export function AdsPanel({ insights }: { insights: AdsInsights }) {
  if (!insights.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meta Ads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Not connected. To pull Facebook Ads metrics into this dashboard, set:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>
              <code>META_AD_ACCOUNT_ID</code> — your ad account ID without the
              &quot;act_&quot; prefix
            </li>
            <li>
              <code>META_ADS_ACCESS_TOKEN</code> — long-lived user or system-user
              token with <code>ads_read</code> scope
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Get a token at{" "}
            <a
              className="underline"
              href="https://developers.facebook.com/tools/explorer"
              target="_blank"
              rel="noreferrer"
            >
              Graph API Explorer
            </a>
            : pick your app, set User Token + <code>ads_read</code> scope,
            generate, then exchange for a long-lived token.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (insights.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meta Ads</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-destructive">Error: {insights.error}</p>
        </CardContent>
      </Card>
    );
  }

  const roas =
    insights.spendCents > 0
      ? insights.purchaseValueCents / insights.spendCents
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Meta Ads <span className="text-xs font-normal text-muted-foreground">({insights.since} → {insights.until})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          <Row label="Spend" value={formatCents(insights.spendCents)} />
          <Row label="Impressions" value={fmtNum(insights.impressions)} />
          <Row label="Reach" value={fmtNum(insights.reach)} />
          <Row label="Clicks" value={fmtNum(insights.clicks)} />
          <Row label="CTR" value={fmtPct(insights.ctr)} />
          <Row label="CPM" value={fmtDollars(insights.cpm)} />
          <Row label="CPC" value={fmtDollars(insights.cpc)} />
          <Row label="Purchases" value={fmtNum(insights.purchases)} />
          <Row
            label="Cost per purchase"
            value={insights.purchases > 0 ? fmtDollars(insights.costPerPurchase) : "–"}
          />
          <Row label="Purchase value" value={formatCents(insights.purchaseValueCents)} />
          <Row label="ROAS" value={`${roas.toFixed(2)}x`} />
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
