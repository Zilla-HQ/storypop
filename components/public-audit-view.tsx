import Link from "next/link";
import { AuditForm } from "@/components/audit-form";
import { ShareButtons } from "@/components/share-buttons";
import { letterGrade, gradeColor, gradeNarrative } from "@/lib/grade";
import { recommendationFor } from "@/lib/check-recommendations";

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

const STATUS_COPY: Record<SeoCheck["status"], { label: string; tone: string }> = {
  pass: { label: "Pass", tone: "bg-emerald-100 text-emerald-800" },
  warn: { label: "Warning", tone: "bg-amber-100 text-amber-800" },
  fail: { label: "Fail", tone: "bg-red-100 text-red-800" },
};

export function PublicAuditView({
  domain,
  siteUrl,
  score,
  report,
  runAt,
}: {
  domain: string;
  siteUrl: string;
  score: number;
  report: AuditReport | null;
  runAt: Date | null;
}) {
  const grade = letterGrade(score);
  const color = gradeColor(grade);
  const narrative = gradeNarrative(grade);
  const checks = report?.checks ?? [];
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const passes = checks.filter((c) => c.status === "pass");

  return (
    <div className="space-y-12">
      <header className="flex flex-col items-center gap-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          SEO Audit
        </p>
        <h1 className="break-all text-3xl font-bold tracking-tight sm:text-4xl">
          {domain}
        </h1>
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full text-5xl font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {grade}
          </div>
          <p className="text-2xl font-semibold">{score}/100</p>
          <p className="max-w-md text-sm text-muted-foreground">{narrative}</p>
          {runAt && (
            <p className="text-xs text-muted-foreground">
              Last checked {new Date(runAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/?url=${encodeURIComponent(domain)}`}
            className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Re-run audit + monitor weekly →
          </Link>
          <Link
            href="/pricing"
            className="rounded-md border px-5 py-3 text-sm font-semibold hover:bg-muted"
          >
            See pricing
          </Link>
        </div>
        <div className="pt-2">
          <ShareButtons title={`${domain} — SEO grade ${grade} (${score}/100)`} />
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4 text-center">
        <Stat label="Failing" value={fails.length} tone="text-red-600" />
        <Stat label="Warnings" value={warns.length} tone="text-amber-600" />
        <Stat label="Passing" value={passes.length} tone="text-emerald-600" />
      </section>

      {fails.length > 0 && (
        <CheckGroup
          title={`${fails.length} ${fails.length === 1 ? "issue" : "issues"} hurting your SEO`}
          subtitle="Each of these costs traffic. Fix instructions included below."
          checks={fails}
        />
      )}
      {warns.length > 0 && (
        <CheckGroup
          title={`${warns.length} ${warns.length === 1 ? "warning" : "warnings"}`}
          subtitle="Quick wins — fixing these moves you up a letter grade."
          checks={warns}
        />
      )}
      {passes.length > 0 && (
        <CheckGroup
          title={`${passes.length} passing checks`}
          subtitle="Already doing these right."
          checks={passes}
          collapsedByDefault
        />
      )}

      <section className="rounded-xl border bg-emerald-50 p-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Run a free audit on your site
          </h2>
          <p className="mt-3 text-muted-foreground">
            Drop your URL — get a graded 13-check report in 30 seconds.
            Optional email to receive the report inbox-side.
          </p>
          <div className="mt-6">
            <AuditForm />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Or{" "}
            <Link
              href={`/?url=${encodeURIComponent(domain)}`}
              className="underline-offset-2 hover:underline"
            >
              re-run on {domain}
            </Link>{" "}
            ·{" "}
            <Link href="/pricing" className="underline-offset-2 hover:underline">
              see pricing
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Audited URL: <span className="break-all">{siteUrl}</span>
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function CheckGroup({
  title,
  subtitle,
  checks,
  collapsedByDefault = false,
}: {
  title: string;
  subtitle: string;
  checks: SeoCheck[];
  collapsedByDefault?: boolean;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {checks.map((c) => (
          <details
            key={c.id}
            className="group rounded-lg border bg-card p-4"
            open={!collapsedByDefault}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COPY[c.status].tone}`}
                >
                  {STATUS_COPY[c.status].label}
                </span>
                <span className="font-semibold">{c.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {c.earned}/{c.points} pts
              </span>
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-muted-foreground">{c.detail}</p>
              {c.status !== "pass" && (() => {
                const rec = recommendationFor(c.id);
                if (!rec) return null;
                return (
                  <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                    <p>
                      <span className="font-semibold">Why it matters: </span>
                      {rec.why}
                    </p>
                    <p>
                      <span className="font-semibold">Fix: </span>
                      {rec.fix}
                    </p>
                  </div>
                );
              })()}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
