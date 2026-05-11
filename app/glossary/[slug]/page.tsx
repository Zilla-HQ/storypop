import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GLOSSARY, getGlossaryTerm } from "@/lib/glossary-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) return { title: "Term — Sitebeat" };
  return {
    title: `What is ${term.term}? — SEO glossary — Sitebeat`,
    description: `${term.definition} ${term.intent}.`,
    alternates: { canonical: `/glossary/${term.slug}` },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) notFound();

  const relatedTerms = term.related
    .map((r) => GLOSSARY.find((t) => t.slug === r))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <article className="container max-w-3xl py-12">
      <Link
        href="/glossary"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← All terms
      </Link>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        SEO Glossary
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        {term.term}
      </h1>
      <p className="mt-4 text-xl leading-relaxed text-muted-foreground">
        {term.definition}
      </p>

      <section className="mt-10 space-y-5">
        {term.body.map((p, i) => (
          <p key={i} className="text-base leading-relaxed text-foreground/90">
            {p}
          </p>
        ))}
      </section>

      {term.examples && term.examples.length > 0 && (
        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Examples</h2>
          {term.examples.map((ex, i) => (
            <div key={i} className="rounded-lg border bg-card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {ex.label}
              </div>
              {ex.code ? (
                <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">
                  <code>{ex.code}</code>
                </pre>
              ) : null}
              {ex.text ? (
                <p className="mt-3 text-sm">{ex.text}</p>
              ) : null}
            </div>
          ))}
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-3">
          {term.faq.map((q) => (
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

      {term.toolHref && term.toolCta && (
        <section className="mt-12 rounded-xl border bg-emerald-50 p-8 text-center">
          <p className="text-base font-medium">
            Want a tool to check this on your site?
          </p>
          <Link
            href={term.toolHref}
            className="mt-4 inline-block rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {term.toolCta}
          </Link>
        </section>
      )}

      {relatedTerms.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="text-xl font-bold tracking-tight">Related terms</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {relatedTerms.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/glossary/${r.slug}`}
                  className="text-sm text-emerald-700 hover:underline"
                >
                  {r.term} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            name: term.term,
            description: term.definition,
            inDefinedTermSet: {
              "@type": "DefinedTermSet",
              name: "Sitebeat SEO Glossary",
              url: "https://sitebeat.tech/glossary",
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: term.faq.map((q) => ({
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
