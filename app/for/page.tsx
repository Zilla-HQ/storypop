import type { Metadata } from "next";
import Link from "next/link";
import { AUDIENCES } from "@/lib/audiences-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sitebeat for — agencies, freelancers, indie founders, more",
  description:
    "Sitebeat is built differently for different audiences. Pick yours to see use cases, pricing, and partner-program details tuned for you.",
  alternates: { canonical: "/for" },
};

export default function ForIndexPage() {
  return (
    <div className="container max-w-3xl py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Built for
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Sitebeat for...
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Pick your role to see use cases and pricing tuned for how you
        actually work.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {AUDIENCES.map((a) => (
          <Link
            key={a.slug}
            href={`/for/${a.slug}`}
            className="flex flex-col rounded-lg border bg-card p-6 hover:bg-muted/30"
          >
            <h2 className="text-lg font-semibold">{a.name}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              {a.positioning}
            </p>
            <span className="mt-4 text-sm font-semibold text-emerald-700">
              See use case →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
