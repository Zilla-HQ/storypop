import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditForm } from "@/components/audit-form";
import { AUDIENCES, getAudience } from "@/lib/audiences-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return AUDIENCES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getAudience(slug);
  if (!a) return { title: "Sitebeat for —" };
  return {
    title: `Sitebeat for ${a.name} — $29/mo SEO monitoring`,
    description: a.positioning,
    alternates: { canonical: `/for/${a.slug}` },
  };
}

export default async function AudiencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getAudience(slug);
  if (!a) notFound();

  const otherAudiences = AUDIENCES.filter((x) => x.slug !== a.slug);

  return (
    <article className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sitebeat for
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        {a.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{a.positioning}</p>

      <div className="mt-10 rounded-xl border bg-amber-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-amber-900">
          The pain
        </p>
        <p className="mt-3 text-base leading-relaxed text-amber-950">{a.pain}</p>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">
          What Sitebeat does for {a.name.toLowerCase()}
        </h2>
        <ul className="mt-6 space-y-3">
          {a.valueProps.map((vp, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border bg-card p-5 text-sm"
            >
              <span className="text-emerald-600">✓</span>
              <span className="leading-relaxed">{vp}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-xl border bg-emerald-50 p-8">
        <h2 className="text-2xl font-bold tracking-tight">Pricing</h2>
        <p className="mt-3 text-base">{a.pricingAngle}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            See pricing →
          </Link>
          <Link
            href="/partners"
            className="rounded-md border bg-background px-5 py-3 text-sm font-semibold hover:bg-muted"
          >
            Affiliate program
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">Try it now</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Free 13-check audit, 30 seconds, no signup.
        </p>
        <div className="mt-6">
          <AuditForm />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-3">
          {a.faq.map((q) => (
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

      {otherAudiences.length > 0 && (
        <section className="mt-16 border-t pt-8">
          <h2 className="text-xl font-bold tracking-tight">
            Sitebeat for other audiences
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {otherAudiences.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/for/${o.slug}`}
                  className="text-sm text-emerald-700 hover:underline"
                >
                  Sitebeat for {o.name.toLowerCase()} →
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
            "@type": "FAQPage",
            mainEntity: a.faq.map((q) => ({
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
