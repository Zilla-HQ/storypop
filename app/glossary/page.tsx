import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY } from "@/lib/glossary-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "SEO glossary — definitions for every SEO term — Sitebeat",
  description:
    "Plain-English definitions for every SEO term you'll encounter — meta description, canonical tag, schema markup, Core Web Vitals, and more.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryIndexPage() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Glossary
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        SEO glossary
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Plain-English definitions for every SEO term you&rsquo;ll encounter
        when running or auditing a website. Each entry includes
        examples, common pitfalls, and links to fix tools.
      </p>

      <div className="mt-12 space-y-3">
        {sorted.map((t) => (
          <Link
            key={t.slug}
            href={`/glossary/${t.slug}`}
            className="block rounded-lg border bg-card p-5 hover:bg-muted/30"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{t.term}</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Read →
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.definition}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
