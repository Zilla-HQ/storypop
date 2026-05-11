import Link from "next/link";
import { db, partnerOutreach } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerBulkAddForm } from "@/components/admin/partner-bulk-add-form";
import { PartnerImportFromSites } from "@/components/admin/partner-import-from-sites";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  queued: "bg-slate-200 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  replied: "bg-emerald-100 text-emerald-800",
  interested: "bg-emerald-100 text-emerald-800",
  joined: "bg-emerald-200 text-emerald-900",
  passed: "bg-amber-100 text-amber-800",
  unsubscribed: "bg-red-100 text-red-800",
};

export default async function PartnerOutreachPage() {
  const rows = await db
    .select()
    .from(partnerOutreach)
    .orderBy(desc(partnerOutreach.lastRepliedAt), desc(partnerOutreach.lastSentAt), desc(partnerOutreach.createdAt))
    .limit(200)
    .catch(() => []);

  const counts = await db
    .select({
      status: partnerOutreach.status,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(partnerOutreach)
    .groupBy(partnerOutreach.status)
    .catch(() => []);
  const countMap = new Map(counts.map((c) => [c.status, c.count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Partner outreach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cold-email web designers, SEO freelancers, and consultants from{" "}
          <code>partners@</code>. Replies land in the prospect&rsquo;s thread
          via the inbound webhook — no manual matching.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(["queued", "sent", "replied", "interested", "joined", "unsubscribed"] as const).map((s) => (
          <div key={s} className="rounded-lg border bg-card p-3 text-center">
            <div className={`mx-auto inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s]}`}>
              {s}
            </div>
            <div className="mt-2 text-2xl font-bold">{countMap.get(s) ?? 0}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Add prospects</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste one email per line, or
            <code className="mx-1">email,name,company,notes</code>
            CSV. Existing addresses are deduped; blacklisted addresses are
            skipped silently. Toggle the option below to send the initial
            pitch immediately.
          </p>
          <div className="mt-4">
            <PartnerBulkAddForm />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">
            Import from existing sites (no Apify)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mines the <code>sites</code> table for hostnames matching agency
            keywords (no new Yelp / Apify calls). Scrapes contact emails
            directly from each site, MX-validates, deduplicates against
            partner_outreach, and optionally fires the initial pitch.
          </p>
          <div className="mt-4">
            <PartnerImportFromSites />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              No prospects yet. Add some above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Sends</th>
                    <th className="px-4 py-3 text-right">Replies</th>
                    <th className="px-4 py-3 text-left">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/partner-outreach/${r.id}`}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          {r.email}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            STATUS_TONE[r.status] ?? "bg-muted"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{r.sendCount}</td>
                      <td className="px-4 py-3 text-right">{r.replyCount}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.lastRepliedAt
                          ? `↩ ${new Date(r.lastRepliedAt).toLocaleDateString()}`
                          : r.lastSentAt
                            ? `→ ${new Date(r.lastSentAt).toLocaleDateString()}`
                            : new Date(r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
