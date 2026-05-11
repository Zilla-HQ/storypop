import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/footer";
import { AuditForm } from "@/components/audit-form";
import { listRecentAudits } from "@/lib/audit-lookup";
import { letterGrade, gradeColor } from "@/lib/grade";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "SEO Audits — recently checked sites — Sitebeat",
  description:
    "Browse recent free SEO audits. See how real sites score across 13 SEO checks. Run a free audit on your own site in 30 seconds.",
  alternates: { canonical: "/seo-audit" },
};

export default async function SeoAuditIndexPage() {
  const recent = await listRecentAudits(120);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Sitebeat
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/tools" className="text-muted-foreground hover:text-foreground">
              Tools
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-4xl flex-1 py-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Free SEO Audits
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            See how real sites score
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Each audit runs 13 SEO checks against the live site. Run yours
            free below — no signup, results in 30 seconds.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <AuditForm />
          </div>
        </div>

        {recent.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">
              Recently audited
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Public reports from the last batch of audits. Click through
              to see the full breakdown.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {recent.map((r) => {
                const grade = letterGrade(r.score);
                const color = gradeColor(grade);
                return (
                  <Link
                    key={r.domain}
                    href={`/seo-audit/${encodeURIComponent(r.domain)}`}
                    className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-muted/50"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {grade}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.domain}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.score}/100 ·{" "}
                        {r.runAt
                          ? new Date(r.runAt).toLocaleDateString()
                          : "—"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
