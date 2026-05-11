import type { Metadata } from "next";
import Link from "next/link";
import { CITIES, INDUSTRIES } from "@/lib/industries-catalog";
import { PLATFORMS } from "@/lib/platforms-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Local SEO by industry — Sitebeat",
  description:
    "Industry-specific SEO audits and weekly monitoring for plumbers, dentists, lawyers, HVAC, restaurants, and more — across the major US metros.",
  alternates: { canonical: "/seo-for" },
};

export default function SeoForIndexPage() {
  return (
    <div className="container max-w-4xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Local SEO
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Local SEO by industry
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Pick your industry to see the SEO issues we routinely find on
        sites in that vertical — and how to fix them.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Industries</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {INDUSTRIES.map((i) => (
            <Link
              key={i.slug}
              href={`/seo-for/${i.slug}/${CITIES[0].slug}`}
              className="rounded-lg border bg-card p-5 hover:bg-muted/30"
            >
              <div className="font-semibold capitalize">SEO for {i.noun}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {i.topIssues.length} common issues we find on {i.nounSingular}{" "}
                websites.
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">By platform / CMS</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <Link
              key={p.slug}
              href={`/seo-for/platform/${p.slug}`}
              className="rounded-lg border bg-card p-5 hover:bg-muted/30"
            >
              <div className="font-semibold">SEO for {p.name}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Platform-specific issues and quick wins.
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Cities we cover</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/seo-for/${INDUSTRIES[0].slug}/${c.slug}`}
              className="rounded-full border bg-background px-3 py-1 text-muted-foreground hover:bg-muted"
            >
              {c.name}, {c.region}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
