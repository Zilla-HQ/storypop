import { notFound } from "next/navigation";
import Link from "next/link";
import { db, audits, sites, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { AuditReportView } from "@/components/audit-report-view";
import { ScoreHistory } from "@/components/score-history";
import { SubscribeTracker } from "@/components/subscribe-tracker";

export const dynamic = "force-dynamic";

export default async function AuditResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ subscribed?: string; meta_eid?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const rows = await db
    .select({
      audit: audits,
      site: sites,
    })
    .from(audits)
    .innerJoin(sites, eq(sites.id, audits.siteId))
    .where(eq(audits.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  // Is the underlying site subscribed? Show the score-history chart if so.
  const [activeSub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.siteId, row.site.id))
    .limit(1);
  const isSubscribed = sp.subscribed === "1" || Boolean(activeSub);

  return (
    <main className="container max-w-3xl py-16">
      <SubscribeTracker subscribed={sp.subscribed === "1"} metaEventId={sp.meta_eid} />
      <AuditReportView
        auditId={row.audit.id}
        initialStatus={row.audit.status}
        initialScore={row.audit.score ?? null}
        initialReport={row.audit.report ?? null}
        siteUrl={row.site.siteUrl}
        siteId={row.site.id}
        subscribed={isSubscribed}
      />

      {isSubscribed && (
        <div className="mt-10">
          <ScoreHistory siteId={row.site.id} />
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t pt-6 text-sm">
        <Link
          href={`/audit/${id}/print`}
          target="_blank"
          rel="noopener"
          className="rounded-md border px-4 py-2 font-semibold hover:bg-muted"
        >
          🖨 Save as PDF
        </Link>
        <span className="text-muted-foreground">
          Print-friendly view → use ⌘P / Ctrl+P → "Save as PDF"
        </span>
      </div>
    </main>
  );
}
