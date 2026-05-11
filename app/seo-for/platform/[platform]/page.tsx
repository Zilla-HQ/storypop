import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditForm } from "@/components/audit-form";
import { PLATFORMS, getPlatform } from "@/lib/platforms-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return PLATFORMS.map((p) => ({ platform: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const { platform } = await params;
  const p = getPlatform(platform);
  if (!p) return { title: "Platform SEO — Sitebeat" };
  return {
    title: `SEO for ${p.name} — common issues + fixes — Sitebeat`,
    description: `${p.name} SEO problems we routinely find when auditing sites built on this stack — and the platform-specific fixes that move the needle.`,
    alternates: { canonical: `/seo-for/platform/${p.slug}` },
  };
}

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const p = getPlatform(platform);
  if (!p) notFound();

  const others = PLATFORMS.filter((x) => x.slug !== p.slug);

  return (
    <article className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Platform SEO
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        SEO for {p.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{p.positioning}</p>

      <div className="mt-8">
        <AuditForm />
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">
          The 5 issues we routinely find on {p.name} sites
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Compiled from auditing thousands of {p.name} stores and websites.
        </p>
        <ol className="mt-6 space-y-4">
          {p.topIssues.map((issue, idx) => (
            <li key={idx} className="flex gap-4 rounded-lg border bg-card p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <span className="text-sm leading-relaxed">{issue}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">
          Quick wins specific to {p.name}
        </h2>
        <ul className="mt-6 space-y-3">
          {p.quickWins.map((w, idx) => (
            <li
              key={idx}
              className="flex gap-3 rounded-lg border bg-emerald-50 p-4"
            >
              <span className="text-emerald-600">✓</span>
              <span className="text-sm">{w}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-xl border bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Want {p.name} SEO checked every Monday?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Sitebeat re-audits your {p.name} site every week and emails you
          only when something regresses. $29/mo, cancel anytime.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Run free audit →
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-3">
          {p.faq.map((q) => (
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

      <section className="mt-16 border-t pt-10">
        <h2 className="text-xl font-bold tracking-tight">
          SEO guides for other platforms
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {others.map((o) => (
            <li key={o.slug}>
              <Link
                href={`/seo-for/platform/${o.slug}`}
                className="text-sm text-emerald-700 hover:underline"
              >
                SEO for {o.name} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: p.faq.map((q) => ({
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
