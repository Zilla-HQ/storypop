import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditForm } from "@/components/audit-form";
import {
  CITIES,
  INDUSTRIES,
  getCity,
  getIndustry,
  allIndustryCityCombos,
} from "@/lib/industries-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return allIndustryCityCombos();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ industry: string; city: string }>;
}): Promise<Metadata> {
  const { industry, city } = await params;
  const i = getIndustry(industry);
  const c = getCity(city);
  if (!i || !c) return { title: "Local SEO — Sitebeat" };
  return {
    title: `SEO for ${i.noun} in ${c.name} ${c.region} — Sitebeat`,
    description: `Free SEO audit + weekly monitoring built for ${i.noun} in ${c.name}. The 5 SEO issues we routinely find on ${i.nounSingular} websites — and how to fix them.`,
    alternates: { canonical: `/seo-for/${i.slug}/${c.slug}` },
  };
}

export default async function IndustryCityPage({
  params,
}: {
  params: Promise<{ industry: string; city: string }>;
}) {
  const { industry, city } = await params;
  const i = getIndustry(industry);
  const c = getCity(city);
  if (!i || !c) notFound();

  const otherCities = CITIES.filter((x) => x.slug !== c.slug).slice(0, 8);
  const relatedIndustries = INDUSTRIES.filter((x) =>
    i.related.includes(x.slug),
  );

  return (
    <article className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Local SEO
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        SEO for {i.noun} in {c.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Most {i.noun} in {c.name} are losing search traffic to fixable
        SEO mistakes. Run a free 13-point audit on your site and we&rsquo;ll
        email you a graded report — no signup, no credit card.
      </p>

      <div className="mt-8">
        <AuditForm />
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">
          The 5 issues we routinely find on {i.nounSingular} websites
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Compiled from auditing thousands of small business sites across
          North America.
        </p>
        <ol className="mt-6 space-y-4">
          {i.topIssues.map((issue, idx) => (
            <li key={idx} className="flex gap-4 rounded-lg border bg-card p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <span className="text-sm leading-relaxed">{issue}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-xl border bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {c.name}-specific SEO matters more than national SEO
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Customers searching for &ldquo;{i.nounSingular} in {c.name}&rdquo;
          or &ldquo;{i.nounSingular} near me&rdquo; from inside {c.name}{" "}
          are 10× more likely to call than national-keyword traffic.
          Sitebeat checks the markup that powers local rich results — so
          you actually show up.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">
          What Sitebeat does for {i.noun}
        </h2>
        <ul className="mt-4 space-y-3 text-base">
          <li className="flex gap-3">
            <span className="text-emerald-600">✓</span>
            <span>
              Runs a 13-point SEO audit against your live homepage
              (HTTPS, meta description, headings, page speed, sitemap,
              robots.txt, canonical, mobile viewport, alt text, Open
              Graph, broken links, structured data).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-600">✓</span>
            <span>
              Re-runs the audit every Monday morning and emails you only
              if something regresses.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-600">✓</span>
            <span>
              Forwardable to your developer with exact fix instructions
              for every failed check.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-600">✓</span>
            <span>$29/mo flat. Cancel any time. No long-term contract.</span>
          </li>
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight">
          SEO for {i.noun} in other cities
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {otherCities.map((oc) => (
            <li key={oc.slug}>
              <Link
                href={`/seo-for/${i.slug}/${oc.slug}`}
                className="text-sm text-emerald-700 hover:underline"
              >
                SEO for {i.noun} in {oc.name} {oc.region} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {relatedIndustries.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Related industries in {c.name}
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {relatedIndustries.map((ri) => (
              <li key={ri.slug}>
                <Link
                  href={`/seo-for/${ri.slug}/${c.slug}`}
                  className="text-sm text-emerald-700 hover:underline"
                >
                  SEO for {ri.noun} in {c.name} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
