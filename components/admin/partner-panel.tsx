import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";
import type { PartnerAttributionSummary } from "@/lib/admin-metrics";

interface Props {
  summary: PartnerAttributionSummary;
}

/**
 * Partner / affiliate attribution panel — joins listings tagged with
 * utm_source=partner against paid orders, computes 30% commission. Empty state
 * is fine — until /partners has approved partners, this stays at zero.
 */
export function PartnerPanel({ summary }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Partner attribution</span>
          <Link
            href="/admin/partners"
            className="text-xs font-normal text-primary hover:underline"
          >
            Generate referral link →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Active partners" value={summary.rows.length.toString()} />
          <Stat label="Leads" value={summary.totalLeads.toString()} />
          <Stat label="Paid orders" value={summary.totalPaidOrders.toString()} />
          <Stat
            label="Commission owed"
            value={formatCents(summary.totalCommissionCents)}
            highlight
          />
        </div>

        {summary.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No partner-attributed traffic yet. Approved partners send links of the
            form{" "}
            <code className="text-xs">
              ?utm_source=partner&utm_content=&lt;handle&gt;
            </code>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 font-semibold">Partner</th>
                  <th className="py-2 text-right font-semibold">Leads</th>
                  <th className="py-2 text-right font-semibold">Paid</th>
                  <th className="py-2 text-right font-semibold">Revenue</th>
                  <th className="py-2 text-right font-semibold">Commission</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.partnerHandle} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-mono text-xs">{r.partnerHandle}</td>
                    <td className="py-2 text-right tabular-nums">{r.leads}</td>
                    <td className="py-2 text-right tabular-nums">{r.paidOrders}</td>
                    <td className="py-2 text-right tabular-nums">{formatCents(r.revenueCents)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {formatCents(r.commissionCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Commission settles every Friday via Stripe Connect (or manual transfer
          until 10+ active partners). Refunded orders within the 14-day window
          claw back commission automatically since they leave the{" "}
          <code className="text-xs">paid</code> status.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{props.label}</div>
      <div
        className={`text-2xl font-bold tabular-nums ${props.highlight ? "text-emerald-700" : ""}`}
      >
        {props.value}
      </div>
    </div>
  );
}
