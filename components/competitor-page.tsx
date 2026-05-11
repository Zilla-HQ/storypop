import Link from "next/link";
import { AuditForm } from "@/components/audit-form";
import type { CompetitorDef } from "@/lib/competitors-catalog";

export function CompetitorPage({
  competitor,
  variant,
}: {
  competitor: CompetitorDef;
  variant: "vs" | "alternatives";
}) {
  const headline =
    variant === "vs"
      ? `Sitebeat vs ${competitor.name}`
      : `Best ${competitor.name} alternatives`;

  const subhead =
    variant === "vs"
      ? `${competitor.angle}`
      : `${competitor.name} starts at ${competitor.pricing}. If you only need site auditing + weekly monitoring, Sitebeat does that for $29/mo.`;

  return (
    <article className="container max-w-4xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {variant === "vs" ? "Comparison" : "Alternatives"}
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        {headline}
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{subhead}</p>

      <section className="mt-10 space-y-4">
        {competitor.intro.map((p, i) => (
          <p key={i} className="text-base leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">
          Side-by-side comparison
        </h2>
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-semibold">Feature</th>
                <th className="px-4 py-3 text-left font-semibold text-emerald-700">
                  Sitebeat
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {competitor.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {competitor.rows.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium">{row.feature}</td>
                  <td className="px-4 py-3 text-emerald-700">{row.sitebeat}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-emerald-50 p-6">
          <h3 className="text-lg font-semibold">Pick Sitebeat if</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {competitor.bestForSitebeat.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">Pick {competitor.name} if</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {competitor.considerCompetitor.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16 rounded-xl border bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Try Sitebeat free
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Run a free 13-check audit on your site in 30 seconds. No signup,
          no credit card. If you like it, monitoring is $29/mo.
        </p>
        <div className="mx-auto mt-6 max-w-xl">
          <AuditForm />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-3">
          {competitor.faq.map((q) => (
            <details
              key={q.q}
              className="group rounded-lg border bg-background p-5 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-3 font-semibold">
                {q.q}
                <span className="text-muted-foreground transition group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-12 text-xs text-muted-foreground">
        {competitor.name} pricing and feature claims reflect publicly
        available information at the time of writing and may change. We
        update this page when we notice material changes — flag any
        inaccuracy at <Link href="/" className="underline">our homepage</Link>.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: competitor.faq.map((q) => ({
              "@type": "Question",
              name: q.q,
              acceptedAnswer: { "@type": "Answer", text: q.a },
            })),
          }),
        }}
      />
    </article>
  );
}
