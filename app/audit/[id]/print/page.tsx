import { notFound } from "next/navigation";
import { db, audits, sites } from "@/db";
import { eq } from "drizzle-orm";
import { letterGrade, gradeColor, gradeNarrative } from "@/lib/grade";
import { recommendationFor } from "@/lib/check-recommendations";

export const dynamic = "force-dynamic";

type SeoCheck = {
  id: string;
  name: string;
  description: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  points: number;
  earned: number;
};

type AuditReport = {
  score: number;
  checks: SeoCheck[];
  url: string;
  fetchedAt: string;
};

/**
 * Print-friendly audit report. Render is plain HTML with @media print
 * styles so users can save it as PDF via the browser (Cmd+P → "Save as
 * PDF"). No JS needed; works anywhere.
 */
export default async function AuditPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select({ audit: audits, site: sites })
    .from(audits)
    .innerJoin(sites, eq(sites.id, audits.siteId))
    .where(eq(audits.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();
  if (row.audit.status !== "complete" || !row.audit.report) {
    return (
      <main className="container max-w-3xl py-16">
        <p>Report not ready yet.</p>
      </main>
    );
  }

  const r = row.audit.report as AuditReport;
  const grade = letterGrade(r.score);
  const color = gradeColor(grade);
  const narrative = gradeNarrative(grade);
  const failed = r.checks.filter((c) => c.status === "fail");
  const warned = r.checks.filter((c) => c.status === "warn");
  const passed = r.checks.filter((c) => c.status === "pass");
  const issues = [...failed, ...warned];
  const fetchedAt = new Date(r.fetchedAt);

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0.5in; }
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          a { color: inherit; text-decoration: none; }
        }
        body { background: white !important; }
      `}</style>
      <main className="mx-auto max-w-[7.5in] px-6 py-8 text-[13px] leading-relaxed text-black">
        <div className="no-print mb-6 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div>
            <strong>Print-ready view.</strong> Use <kbd>⌘P</kbd> (Mac) or{" "}
            <kbd>Ctrl+P</kbd> (Windows) → "Save as PDF" to download.
          </div>
          <a href={`/audit/${id}`} className="rounded bg-white px-3 py-1.5 text-xs font-semibold">
            ← Back to live report
          </a>
        </div>

        <header className="flex items-start gap-4 border-b pb-6">
          <div
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl text-white"
            style={{ background: color }}
          >
            <div className="text-3xl font-extrabold leading-none">{grade}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase opacity-90">
              {r.score}/100
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Sitebeat audit · {fetchedAt.toISOString().slice(0, 10)}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{r.url}</h1>
            <p className="mt-1 text-gray-600">{narrative}</p>
            <div className="mt-2 flex gap-3 text-[11px]">
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                {passed.length} passing
              </span>
              <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                {warned.length} warnings
              </span>
              <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">
                {failed.length} failing
              </span>
            </div>
          </div>
        </header>

        {issues.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
              Issues to fix ({issues.length})
            </h2>
            <ol className="space-y-4">
              {issues.map((c, i) => {
                const rec = recommendationFor(c.id);
                return (
                  <li key={c.id} className="rounded border-l-4 pl-3" style={{ borderColor: c.status === "fail" ? "#ef4444" : "#f59e0b" }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-semibold">
                        {i + 1}. {c.name}
                      </h3>
                      <span className="text-[11px] text-gray-500">
                        {c.status === "fail" ? "FAIL" : "WARN"} · {c.earned}/{c.points} pts
                      </span>
                    </div>
                    <p className="mt-0.5 text-gray-700">{c.detail}</p>
                    {rec && (
                      <div className="mt-2 space-y-1.5">
                        <div className="text-[12px]">
                          <span className="font-semibold text-gray-700">Why this matters: </span>
                          <span className="text-gray-600">{rec.why}</span>
                        </div>
                        <div className="text-[12px]">
                          <span className="font-semibold text-gray-700">Fix: </span>
                          <span className="text-gray-600">{rec.fix}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {passed.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
              Passing ({passed.length})
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              {passed.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between border-b py-1">
                  <span>{c.name}</span>
                  <span className="text-gray-500">{c.earned}/{c.points}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 border-t pt-4 text-[11px] text-gray-500">
          <div className="flex items-center justify-between">
            <span>Generated by Sitebeat — sitebeat.tech</span>
            <span>Audit ID: {id.slice(0, 8)}</span>
          </div>
          <div className="mt-1">
            Want this every Monday? Subscribe at sitebeat.tech/pricing — $29/mo or $290/yr.
          </div>
        </footer>
      </main>
    </>
  );
}
