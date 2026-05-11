import Link from "next/link";
import { db, audits, sites } from "@/db";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  complete: "bg-emerald-500/10 text-emerald-700",
  pending: "bg-amber-500/10 text-amber-700",
  running: "bg-blue-500/10 text-blue-700",
  error: "bg-red-500/10 text-red-700",
};

export default async function AdminAuditsPage() {
  const rows = await db
    .select({
      id: audits.id,
      status: audits.status,
      score: audits.score,
      ttfbMs: audits.ttfbMs,
      runAt: audits.runAt,
      createdAt: audits.createdAt,
      errorMessage: audits.errorMessage,
      siteUrl: sites.siteUrl,
      customerEmail: sites.customerEmail,
    })
    .from(audits)
    .innerJoin(sites, eq(sites.id, audits.siteId))
    .orderBy(desc(audits.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last 100 audit runs across all sites. Click any to see the full report.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No audits yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                  <th className="px-4 py-3 text-right font-medium">TTFB</th>
                  <th className="px-4 py-3 text-right font-medium">When</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="max-w-[260px] truncate px-4 py-2.5 font-mono text-xs">
                      {r.siteUrl}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? "bg-muted"}`}
                      >
                        {r.status}
                      </span>
                      {r.errorMessage && (
                        <span className="ml-2 text-xs text-red-600">{r.errorMessage.slice(0, 40)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.score !== null ? `${r.score}/100` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                      {r.ttfbMs !== null ? `${r.ttfbMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {(r.runAt ?? r.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/audit/${r.id}`}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        view →
                      </Link>
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
