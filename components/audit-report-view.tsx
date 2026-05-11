"use client";

import { useEffect, useState } from "react";
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

type AuditState = {
  status: string;
  score: number | null;
  report: AuditReport | null;
  errorMessage?: string | null;
};

export function AuditReportView({
  auditId,
  initialStatus,
  initialScore,
  initialReport,
  siteUrl,
  siteId,
  subscribed,
}: {
  auditId: string;
  initialStatus: string;
  initialScore: number | null;
  initialReport: unknown;
  siteUrl: string;
  siteId: string;
  subscribed?: boolean;
}) {
  const [state, setState] = useState<AuditState>({
    status: initialStatus,
    score: initialScore,
    report: (initialReport as AuditReport | null) ?? null,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state.status === "complete" || state.status === "error") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/audit?id=${auditId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as AuditState & { runAt?: string };
        if (cancelled) return;
        setState({
          status: json.status,
          score: json.score ?? null,
          report: (json.report as AuditReport | null) ?? null,
          errorMessage: json.errorMessage,
        });
      } catch {
        /* keep polling */
      }
    };
    const interval = setInterval(tick, 2500);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auditId, state.status]);

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h1 className="text-xl font-semibold text-destructive">Audit failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.errorMessage ?? "Something went wrong while crawling the site."}
        </p>
      </div>
    );
  }

  if (state.status !== "complete" || !state.report) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Auditing {siteUrl}…</h1>
        <p className="text-muted-foreground">
          Crawling the page and running 13 SEO checks. This usually takes 10–30 seconds.
        </p>
      </div>
    );
  }

  const r = state.report;
  const grade = letterGrade(r.score);
  const color = gradeColor(grade);
  const narrative = gradeNarrative(grade);
  const failed = r.checks.filter((c) => c.status === "fail");
  const warned = r.checks.filter((c) => c.status === "warn");
  const passed = r.checks.filter((c) => c.status === "pass");

  const toggle = (id: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {subscribed ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 p-5">
          <h2 className="text-lg font-bold text-emerald-900">
            ✓ Subscribed — weekly monitoring is on.
          </h2>
          <p className="mt-1 text-sm text-emerald-900/80">
            We&rsquo;ll re-run this audit every Monday and only email you when something
            regresses. Manage your billing any time at{" "}
            <a
              href={`/api/billing-portal?siteId=${siteId}`}
              className="underline hover:no-underline"
            >
              your Stripe portal
            </a>
            .
          </p>
        </div>
      ) : null}

      <header className="flex items-start gap-6">
        <div
          className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: color }}
        >
          <div className="text-5xl font-extrabold leading-none">{grade}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider opacity-90">
            {r.score}/100
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{r.url}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">SEO grade: {grade}</h1>
          <p className="mt-2 text-base text-muted-foreground">{narrative}</p>
          <div className="mt-3 flex gap-3 text-xs">
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700">
              {passed.length} passing
            </span>
            <span className="rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-700">
              {warned.length} warnings
            </span>
            <span className="rounded-md bg-red-500/10 px-2 py-1 font-medium text-red-700">
              {failed.length} failing
            </span>
          </div>
        </div>
      </header>

      {!subscribed && (failed.length > 0 || warned.length > 0) && (
        <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/60 p-6">
          <h3 className="text-xl font-bold">
            {failed.length + warned.length} issues are hurting your rankings.
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Subscribe and we&rsquo;ll re-check this site every Monday. The moment any check
            regresses, you get a one-screen email — fix it before customers notice.
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">
            ✓ Free for 14 days. No charge today. Cancel before day 15.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href={`/subscribe?siteId=${siteId}&plan=monthly`}
              className="flex-1 rounded-md bg-emerald-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Start free 14-day trial →
            </a>
            <a
              href={`/subscribe?siteId=${siteId}&plan=annual`}
              className="flex-1 rounded-md bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              $290 / year (save 17%) →
            </a>
          </div>
        </div>
      )}

      {failed.length + warned.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Issues to fix ({failed.length + warned.length})
          </h2>
          <ul className="space-y-3">
            {[...failed, ...warned].map((c) => {
              const rec = recommendationFor(c.id);
              const isExpanded = expanded.has(c.id);
              return (
                <li key={c.id} className={`rounded-lg border p-4 ${c.status === "fail" ? "border-red-300/60 bg-red-50/30" : "border-amber-300/60 bg-amber-50/30"}`}>
                  <div className="flex gap-3">
                    <StatusDot status={c.status} />
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold">{c.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {c.earned}/{c.points} pts
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                      {rec && (
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className="mt-2 text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          {isExpanded ? "Hide fix ↑" : "How to fix this →"}
                        </button>
                      )}
                      {rec && isExpanded && (
                        <div className="mt-3 space-y-2 rounded-md bg-white p-3 text-sm">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Why this matters
                            </span>
                            <p className="mt-1 text-muted-foreground">{rec.why}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Fix
                            </span>
                            <p className="mt-1 whitespace-pre-line text-muted-foreground">{rec.fix}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {passed.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Passing checks ({passed.length})
          </h2>
          <ul className="space-y-2">
            {passed.map((c) => (
              <li key={c.id} className="flex gap-3 rounded-md border p-3">
                <StatusDot status="pass" />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.earned}/{c.points} pts
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: SeoCheck["status"] }) {
  const color =
    status === "pass"
      ? "bg-emerald-500"
      : status === "warn"
        ? "bg-amber-500"
        : "bg-red-500";
  return <div className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}
