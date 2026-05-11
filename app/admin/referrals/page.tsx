import { db, orders } from "@/db";
import { sql, eq, and, isNotNull } from "drizzle-orm";
import { formatCents } from "@/lib/utils";
import { REFERRAL_PAYOUT_CENTS } from "@/lib/referral";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RefRow {
  code: string;
  totalOrders: number;
  paidOrders: number;
  grossRevenueCents: number;
  payoutDueCents: number;
}

async function loadRows(): Promise<RefRow[]> {
  const rows = await db
    .select({
      code: orders.referralCode,
      totalOrders: sql<number>`count(*)::int`,
      paidOrders: sql<number>`count(*) filter (where ${orders.status} = 'paid' or ${orders.status} = 'fulfilled' or ${orders.status} = 'fulfilling')::int`,
      grossRevenueCents: sql<number>`coalesce(sum(${orders.amountCents}) filter (where ${orders.status} = 'paid' or ${orders.status} = 'fulfilled' or ${orders.status} = 'fulfilling'), 0)::int`,
    })
    .from(orders)
    .where(isNotNull(orders.referralCode))
    .groupBy(orders.referralCode);

  return rows
    .filter((r): r is RefRow & { code: string } => Boolean(r.code))
    .map((r) => ({
      ...r,
      payoutDueCents: r.paidOrders * REFERRAL_PAYOUT_CENTS,
    }))
    .sort((a, b) => b.payoutDueCents - a.payoutDueCents);
}

export default async function ReferralsPage() {
  const rows = await loadRows();
  const totals = rows.reduce(
    (acc, r) => ({
      paidOrders: acc.paidOrders + r.paidOrders,
      grossRevenueCents: acc.grossRevenueCents + r.grossRevenueCents,
      payoutDueCents: acc.payoutDueCents + r.payoutDueCents,
    }),
    { paidOrders: 0, grossRevenueCents: 0, payoutDueCents: 0 },
  );

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Affiliate referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per paid listing payout: {formatCents(REFERRAL_PAYOUT_CENTS)}. Codes are
          deterministic SHA-256 of the partner email — see lib/referral.ts.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid orders attributed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.paidOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCents(totals.grossRevenueCents)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payouts due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCents(totals.payoutDueCents)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referrals yet. Share <code>/refer</code> on agent FB groups to seed
              the program.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Code</th>
                  <th className="py-2 text-right">Total orders</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b">
                    <td className="py-2 font-mono">{r.code}</td>
                    <td className="py-2 text-right">{r.totalOrders}</td>
                    <td className="py-2 text-right">{r.paidOrders}</td>
                    <td className="py-2 text-right">{formatCents(r.grossRevenueCents)}</td>
                    <td className="py-2 text-right font-semibold">
                      {formatCents(r.payoutDueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
