import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Free SEO Tools — Sitebeat",
  description:
    "Free SEO checkers: meta description, title tag, robots.txt, sitemap, schema markup. Each runs against your live site in seconds — no signup.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndexPage() {
  return (
    <div className="container max-w-4xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Free Tools
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Free SEO Tools
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Each tool checks one specific SEO signal against your live site.
        No signup, no rate limits, results in seconds. When you want all
        13 checks at once, run a{" "}
        <Link href="/" className="font-semibold text-emerald-700 hover:underline">
          free full audit →
        </Link>
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="flex flex-col rounded-lg border bg-card p-6 hover:bg-muted/30"
          >
            <h2 className="text-lg font-semibold">{t.shortName}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              {t.oneLiner}
            </p>
            <span className="mt-4 text-sm font-semibold text-emerald-700">
              Open tool →
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-16 rounded-xl border bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Want every check at once?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Sitebeat runs all 13 SEO checks in a single 30-second audit and
          emails you the report. Free first audit, $29/mo to keep it
          monitored weekly.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Run free 13-point audit →
        </Link>
      </div>
    </div>
  );
}
