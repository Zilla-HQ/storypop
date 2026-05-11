import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMetaAdsSnapshot } from "@/lib/meta-ads";
import { formatCents } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IN_PROCESS: "bg-blue-50 text-blue-700 border-blue-200",
  PAUSED: "bg-slate-50 text-slate-600 border-slate-200",
  DELETED: "bg-rose-50 text-rose-700 border-rose-200",
  ARCHIVED: "bg-slate-50 text-slate-500 border-slate-200",
  WITH_ISSUES: "bg-amber-50 text-amber-800 border-amber-200",
  CAMPAIGN_PAUSED: "bg-slate-50 text-slate-600 border-slate-200",
  PENDING_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
};

function tone(status: string): string {
  return STATUS_TONE[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

export async function MetaAdsPanel() {
  const snap = await fetchMetaAdsSnapshot();

  if (!snap) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meta Ads (live)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data — either META_CAPI_ACCESS_TOKEN isn't set or the token doesn't
            have <code>ads_read</code> scope. Generate a System User token in Meta
            Business Manager with ads_read + ads_management permissions and set
            <code> META_ADS_ACCESS_TOKEN</code> in Vercel env.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { campaigns, totalSpendCents, totalImpressions, totalClicks, blendedCtr, blendedCpcCents, accountName, currency } = snap;
  const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Meta Ads (live)</span>
          <span className="text-sm font-normal text-muted-foreground">
            {accountName} · {currency}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top-line metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Total spend" value={formatCents(totalSpendCents)} tone="info" />
          <Metric label="Impressions" value={totalImpressions.toLocaleString()} />
          <Metric label="Clicks" value={totalClicks.toLocaleString()} />
          <Metric label="Blended CTR" value={fmtPct(blendedCtr)} />
          <Metric label="Blended CPC" value={blendedCpcCents > 0 ? formatCents(blendedCpcCents) : "—"} />
        </div>

        {/* Per-campaign table */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Campaigns
          </div>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Campaign</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Objective</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="px-3 py-2 text-right font-medium">Impr.</th>
                    <th className="px-3 py-2 text-right font-medium">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium">CPC</th>
                    <th className="px-3 py-2 text-right font-medium">CTR</th>
                    <th className="px-3 py-2 text-right font-medium">LP views</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-sm">
                        <span className="line-clamp-1 max-w-xs font-medium">{c.name}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant="outline" className={tone(c.effectiveStatus)}>
                          {c.effectiveStatus}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {c.objective.replace("OUTCOME_", "").toLowerCase()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatCents(c.spendCents)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.impressions.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.clicks.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.cpcCents > 0 ? formatCents(c.cpcCents) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.impressions > 0 ? fmtPct(c.ctr) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.landingPageViews}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "info" | "warn" }) {
  const valueColor =
    tone === "ok" ? "text-emerald-700"
      : tone === "info" ? "text-blue-700"
      : tone === "warn" ? "text-amber-700"
      : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}
