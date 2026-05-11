import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITY_TARGETS, findCity } from "@/lib/cities";
import { GraderForm } from "@/components/marketing/grader-form";
import { Card, CardContent } from "@/components/ui/card";
import { db, listings } from "@/db";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 86400; // 24h — cached city stats refresh daily.

interface PageProps {
  params: Promise<{ city: string }>;
}

export async function generateStaticParams() {
  return CITY_TARGETS.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  const target = findCity(city);
  if (!target) return { title: "City not found — Restay" };
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency";
  const ogParams = new URLSearchParams({
    city: target.name,
    state: target.state,
    type: "grade",
    signal: target.signal,
  });
  const ogUrl = `${base}/city-og?${ogParams.toString()}`;
  return {
    title: `Free Airbnb listing grader for ${target.name}, ${target.state} — Restay`,
    description: `Score your ${target.name} Airbnb listing 0–100 against what's working in the local market in 2026. Photos, copy, and listing signals — graded in 10 seconds, free.`,
    openGraph: {
      title: `Grade your ${target.name} Airbnb listing — free`,
      description: `${target.marketNote} See where your listing stands.`,
      type: "website",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Grade your ${target.name} Airbnb listing — free`,
      description: target.marketNote,
      images: [ogUrl],
    },
  };
}

export default async function CityGradePage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const target = findCity(citySlug);
  if (!target) notFound();

  // Pull aggregate stats from any listings we've indexed in this city.
  // Best-effort — pages render fine when the table is empty.
  let aggregate: {
    listingCount: number;
    avgPriceCents: number | null;
    avgRating: number | null;
    avgReviewCount: number | null;
  } | null = null;

  try {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        avgPrice: sql<number | null>`avg(${listings.price})::int`,
        avgRating: sql<number | null>`avg(${listings.avgRating})`,
        avgReviewCount: sql<number | null>`avg(${listings.reviewCount})`,
      })
      .from(listings)
      .where(and(eq(listings.city, target.name), eq(listings.state, target.state)));

    if (rows[0] && rows[0].count > 0) {
      aggregate = {
        listingCount: rows[0].count,
        avgPriceCents: rows[0].avgPrice,
        avgRating: rows[0].avgRating,
        avgReviewCount: rows[0].avgReviewCount,
      };
    }
  } catch {
    // DB unreachable in build-time prerender — render the static fallback.
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency";
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Free grader", item: `${base}/grade` },
      {
        "@type": "ListItem",
        position: 3,
        name: `${target.name}, ${target.state}`,
        item: `${base}/grade/${target.slug}`,
      },
    ],
  };
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Free Airbnb listing grader for ${target.name}, ${target.state}`,
    description: target.marketNote,
    url: `${base}/grade/${target.slug}`,
    isPartOf: { "@type": "WebSite", name: "Restay", url: base },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbSchema, webPageSchema]),
        }}
      />
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Free · No signup · {target.name}, {target.state}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            How does your {target.name} Airbnb listing compare?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {target.marketNote}
          </p>
          <div className="mt-10">
            <GraderForm />
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            What matters most in {target.name}.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            The signal hosts in this market most underweight: <strong>{target.signal}</strong>.
            Our grader penalizes listings that bury this in the description instead of leading with it.
          </p>

          {aggregate && (
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-3">
              {aggregate.avgPriceCents && (
                <Card>
                  <CardContent className="space-y-1 p-5 text-center">
                    <div className="text-3xl font-bold">
                      ${Math.round(aggregate.avgPriceCents / 100)}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      avg nightly rate (sampled)
                    </div>
                  </CardContent>
                </Card>
              )}
              {typeof aggregate.avgRating === "number" && (
                <Card>
                  <CardContent className="space-y-1 p-5 text-center">
                    <div className="text-3xl font-bold">
                      {aggregate.avgRating.toFixed(2)}★
                    </div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      avg rating
                    </div>
                  </CardContent>
                </Card>
              )}
              {typeof aggregate.avgReviewCount === "number" && (
                <Card>
                  <CardContent className="space-y-1 p-5 text-center">
                    <div className="text-3xl font-bold">
                      {Math.round(aggregate.avgReviewCount)}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      avg reviews per listing
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
            {aggregate
              ? `Stats sampled across ${aggregate.listingCount} ${target.name} listings indexed by Restay.`
              : `Local stats refresh once we've indexed enough ${target.name} listings — stats panel returns automatically.`}
          </p>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-12">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Want the full Tune-Up?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            We rewrite your title and description, restyle 10 of your photos, and
            generate a 30-day pricing report — delivered in under 4 hours, $79
            one-time.
          </p>
          <div className="mt-6">
            <Link href="/host" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              See the Tune-Up
            </Link>
          </div>
        </div>
      </section>

      <section className="container py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Other markets we grade.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
            {CITY_TARGETS.filter((c) => c.slug !== target.slug)
              .slice(0, 18)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/grade/${c.slug}`}
                  className="rounded-full border px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {c.name}, {c.state}
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
