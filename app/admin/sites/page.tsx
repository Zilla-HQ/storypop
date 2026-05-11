import Link from "next/link";
import { db, sites, audits } from "@/db";
import { desc, sql, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminSitesPage() {
  const rows = await db
    .select({
      id: sites.id,
      siteUrl: sites.siteUrl,
      customerEmail: sites.customerEmail,
      lastAuditAt: sites.lastAuditAt,
      createdAt: sites.createdAt,
      auditCount: sql<number>`(SELECT count(*)::int FROM sitebeat.audits a WHERE a.site_id = ${sites.id})`,
      latestScore: sql<number | null>`(SELECT score FROM sitebeat.audits a WHERE a.site_id = ${sites.id} AND a.status = 'complete' ORDER BY a.run_at DESC NULLS LAST LIMIT 1)`,
    })
    .from(sites)
    .orderBy(desc(sites.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every URL we&rsquo;ve audited. {rows.length} shown (most recent 200).
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No sites yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Customer email</th>
                  <th className="px-4 py-3 text-right font-medium">Audits</th>
                  <th className="px-4 py-3 text-right font-medium">Latest score</th>
                  <th className="px-4 py-3 text-right font-medium">Last audited</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="max-w-[280px] truncate px-4 py-2.5 font-mono text-xs">
                      {r.siteUrl}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.customerEmail ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.auditCount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.latestScore !== null ? `${r.latestScore}/100` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {r.lastAuditAt ? r.lastAuditAt.toISOString().slice(0, 16).replace("T", " ") : "never"}
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
