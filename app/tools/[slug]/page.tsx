import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolRunner } from "@/components/tool-runner";
import { TOOLS, getTool } from "@/lib/tools-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool — Sitebeat" };
  return {
    title: `${tool.longName} — Sitebeat`,
    description: tool.oneLiner,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: tool.longName,
      description: tool.oneLiner,
      type: "website",
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <article className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Free SEO tool
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        {tool.longName}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{tool.oneLiner}</p>

      <div className="mt-8">
        <ToolRunner tool={tool.toolId} ctaCopy={tool.ctaCopy} />
      </div>

      <section className="mt-16 space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Why {tool.shortName.toLowerCase()} matters
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">{tool.why}</p>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-emerald-50 p-6">
          <h3 className="text-lg font-semibold">What good looks like</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {tool.goodPattern.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-red-50 p-6">
          <h3 className="text-lg font-semibold">Common failures</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {tool.badPattern.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-red-600">✗</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">How to fix it</h2>
        <ol className="mt-4 space-y-3 text-base leading-relaxed">
          {tool.fix.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 rounded-xl border bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Get all 13 SEO checks
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          The {tool.shortName} above checks one thing. Sitebeat&rsquo;s full
          audit checks 13 — HTTPS, headings, page speed, sitemap, robots,
          canonical, schema, broken links, alt text, Open Graph, and more.
          Free, 30 seconds, no signup.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Run free 13-point audit →
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-3">
          {tool.faq.map((q) => (
            <details
              key={q.q}
              className="group rounded-lg border bg-background p-5 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-3 font-semibold">
                {q.q}
                <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.a}</p>
            </details>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: tool.faq.map((q) => ({
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
