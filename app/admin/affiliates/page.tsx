import { db, audits, subscriptions, sites } from "@/db";
import { desc, eq, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface RefStats {
  ref: string;
  audits: number;
  subscriptions: number;
  active: number;
  monthlyRevenueCents: number;
  annualRevenueCents: number;
}

export default async function AffiliatesPage() {
  // Audit-level ref attribution lives in `audits.utm_source` /
  // `utm_campaign`. The /api/audit endpoint is currently writing the
  // ref cookie content into the attribution record under utmSource
  // when set; we extend coverage here to also count rows where
  // utm_source matches a subscription ref.
  const auditCounts = await db
    .select({
      ref: audits.utmSource,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(audits)
    .where(isNotNull(audits.utmSource))
    .groupBy(audits.utmSource);

  const subRows = await db
    .select({
      ref: subscriptions.ref,
      stripePriceId: subscriptions.stripePriceId,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(isNotNull(subscriptions.ref));

  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY ?? "price_monthly_unknown";
  const annualPriceId = process.env.STRIPE_PRICE_ANNUAL ?? "price_annual_unknown";

  const byRef = new Map<string, RefStats>();
  function get(ref: string): RefStats {
    const existing = byRef.get(ref);
    if (existing) return existing;
    const fresh: RefStats = {
      ref,
      audits: 0,
      subscriptions: 0,
      active: 0,
      monthlyRevenueCents: 0,
      annualRevenueCents: 0,
    };
    byRef.set(ref, fresh);
    return fresh;
  }

  for (const row of auditCounts) {
    if (!row.ref) continue;
    get(row.ref).audits = row.count;
  }
  for (const sub of subRows) {
    if (!sub.ref) continue;
    const r = get(sub.ref);
    r.subscriptions += 1;
    if (sub.status === "active" || sub.status === "trialing") {
      r.active += 1;
      if (sub.stripePriceId === monthlyPriceId) r.monthlyRevenueCents += 2900;
      else if (sub.stripePriceId === annualPriceId) r.annualRevenueCents += 29000;
    }
  }

  const allRefs = [...byRef.values()].sort(
    (a, b) =>
      b.monthlyRevenueCents +
      b.annualRevenueCents -
      (a.monthlyRevenueCents + a.annualRevenueCents) ||
      b.subscriptions - a.subscriptions ||
      b.audits - a.audits,
  );

  // Most recent ref-attributed subscriptions:
  const recentSubs = await db
    .select({
      id: subscriptions.id,
      ref: subscriptions.ref,
      customerEmail: subscriptions.customerEmail,
      status: subscriptions.status,
      stripePriceId: subscriptions.stripePriceId,
      createdAt: subscriptions.createdAt,
      siteUrl: sites.siteUrl,
    })
    .from(subscriptions)
    .innerJoin(sites, eq(sites.id, subscriptions.siteId))
    .where(isNotNull(subscriptions.ref))
    .orderBy(desc(subscriptions.createdAt))
    .limit(50);

  const totalActive = allRefs.reduce((s, r) => s + r.active, 0);
  const totalMrr =
    allRefs.reduce((s, r) => s + r.monthlyRevenueCents, 0) +
    allRefs.reduce((s, r) => s + Math.round(r.annualRevenueCents / 12), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Affiliates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ref-attributed signups grouped by code. Rows where the ref came
          via the {`?ref=`} or {`?via=`} query param at landing time and
          made it into Stripe Checkout metadata.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active ref subs" value={totalActive.toString()} />
        <Stat
          label="Estimated MRR from refs"
          value={`$${(totalMrr / 100).toFixed(2)}`}
        />
        <Stat label="Distinct ref codes" value={allRefs.length.toString()} />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Per-ref breakdown</h2>
        </div>
        {allRefs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No ref-attributed activity yet. Share links with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">?ref=YOUR_CODE</code>{" "}
            in the URL to start attribution.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Ref code</th>
                <th className="px-4 py-3 text-right">Audits</th>
                <th className="px-4 py-3 text-right">Subscriptions</th>
                <th className="px-4 py-3 text-right">Active</th>
                <th className="px-4 py-3 text-right">MRR</th>
              </tr>
            </thead>
            <tbody>
              {allRefs.map((r) => {
                const mrr =
                  (r.monthlyRevenueCents +
                    Math.round(r.annualRevenueCents / 12)) /
                  100;
                return (
                  <tr key={r.ref} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{r.ref}</td>
                    <td className="px-4 py-3 text-right">{r.audits}</td>
                    <td className="px-4 py-3 text-right">{r.subscriptions}</td>
                    <td className="px-4 py-3 text-right">{r.active}</td>
                    <td className="px-4 py-3 text-right">${mrr.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">
            Recent ref-attributed subscriptions
          </h2>
        </div>
        {recentSubs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No rows yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Ref</th>
                <th className="px-4 py-3 text-left">Site</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSubs.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.ref}</td>
                  <td className="px-4 py-3 text-xs break-all">{s.siteUrl}</td>
                  <td className="px-4 py-3 text-xs">{s.customerEmail}</td>
                  <td className="px-4 py-3 text-xs capitalize">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <details className="rounded-lg border bg-muted/20 p-5 text-sm">
        <summary className="cursor-pointer font-semibold">
          How attribution works
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>
            Visitors hit any Sitebeat URL with{" "}
            <code className="rounded bg-background px-1.5 py-0.5">?ref=CODE</code>{" "}
            or{" "}
            <code className="rounded bg-background px-1.5 py-0.5">?via=CODE</code>{" "}
            (Rewardful convention). The <code>RefCapture</code> component
            stores the value in a 60-day first-party cookie.
          </p>
          <p>
            When the visitor subscribes, the <code>SubscribeButton</code>{" "}
            reads the cookie and sends it to <code>/api/checkout</code>,
            which forwards it to Stripe Checkout as{" "}
            <code>client_reference_id</code> and{" "}
            <code>metadata.ref</code>. The Stripe webhook then persists{" "}
            <code>ref</code> on the <code>subscriptions</code> row.
          </p>
          <p>
            Audits captured with <code>?ref=</code> in the URL are
            counted via <code>audits.utm_source</code> (the audit form
            doesn&rsquo;t currently mirror the cookie into utm_source by
            default — to capture pre-subscription audit attribution per
            ref code, also pass <code>?utm_source=CODE</code> alongside
            the ref).
          </p>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
