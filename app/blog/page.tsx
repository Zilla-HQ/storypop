import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sitebeat blog — small business SEO insights",
  description:
    "Practical SEO writing for small business owners and operators. No fluff, no listicle SEO — just the patterns we see auditing thousands of sites.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
};

export default function BlogIndexPage() {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => +new Date(b.datePublished) - +new Date(a.datePublished),
  );

  return (
    <div className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Blog
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Small business SEO, demystified
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        What we learn auditing thousands of small business websites at
        Sitebeat. Practical, specific, and free of SEO-industry jargon.
      </p>

      <div className="mt-12 space-y-6">
        {sorted.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="block rounded-xl border bg-card p-6 hover:bg-muted/30"
          >
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <time>{new Date(p.datePublished).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</time>
              <span>·</span>
              <span>{p.readingMinutes} min read</span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight">{p.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.lede}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-emerald-700">
              Read →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
