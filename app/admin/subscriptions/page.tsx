import { db, subscriptions, sites } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  trialing: "bg-blue-500/10 text-blue-700",
  past_due: "bg-amber-500/10 text-amber-700",
  canceled: "bg-muted text-muted-foreground",
  incomplete: "bg-muted text-muted-foreground",
};

export default async function AdminSubscriptionsPage() {
  const rows = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      stripePriceId: subscriptions.stripePriceId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      customerEmail: subscriptions.customerEmail,
      canceledAt: subscriptions.canceledAt,
      createdAt: subscriptions.createdAt,
      siteUrl: sites.siteUrl,
    })
    .from(subscriptions)
    .innerJoin(sites, eq(sites.id, subscriptions.siteId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(200);

  const [totals] = await db
    .select({
      active: sql<number>`count(*) FILTER (WHERE status = 'active')::int`,
      trialing: sql<number>`count(*) FILTER (WHERE status = 'trialing')::int`,
      past_due: sql<number>`count(*) FILTER (WHERE status = 'past_due')::int`,
      canceled: sql<number>`count(*) FILTER (WHERE status = 'canceled')::int`,
    })
    .from(subscriptions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stripe subscription state, mirrored from webhook events.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["active", "trialing", "past_due", "canceled"] as const).map((s) => (
          <div key={s} className="rounded-lg border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {s.replace("_", " ")}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {totals?.[s] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No subscriptions yet. Stripe webhook hits this table after each
              <code className="mx-1 rounded bg-muted px-1 py-0.5">
                customer.subscription.created
              </code>
              event.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Renews</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="max-w-[260px] truncate px-4 py-2.5 font-mono text-xs">
                      {r.siteUrl}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.customerEmail}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.stripePriceId ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? "bg-muted"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {r.currentPeriodEnd
                        ? r.currentPeriodEnd.toISOString().slice(0, 10)
                        : "—"}
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
