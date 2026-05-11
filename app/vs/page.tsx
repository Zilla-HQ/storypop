import type { Metadata } from "next";
import Link from "next/link";
import { COMPETITORS } from "@/lib/competitors-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sitebeat comparisons — vs Sitechecker, SEOptimer, Ahrefs, more",
  description:
    "Side-by-side comparisons of Sitebeat against the major SEO audit tools. Pick the right tool by use case and price.",
  alternates: { canonical: "/vs" },
};

export default function VsIndexPage() {
  return (
    <div className="container max-w-4xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Comparisons
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Sitebeat vs the major SEO tools
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Honest, factual comparisons. Pick by use case and price — not
        marketing copy.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {COMPETITORS.map((c) => (
          <Link
            key={c.slug}
            href={`/vs/${c.slug}`}
            className="flex flex-col rounded-lg border bg-card p-6 hover:bg-muted/30"
          >
            <h2 className="text-lg font-semibold">Sitebeat vs {c.name}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              {c.positioning}
            </p>
            <span className="mt-4 text-sm font-semibold text-emerald-700">
              See comparison →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
