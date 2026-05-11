import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITY_TARGETS, findCity } from "@/lib/cities";
import { SelfServeForm } from "@/components/marketing/self-serve-form";
import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";
import { FAQ } from "@/components/marketing/faq";
import { Card, CardContent } from "@/components/ui/card";
import { getSampleBeforeAfters } from "@/lib/samples";
import { db, listings } from "@/db";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 86400; // 24h

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
    type: "host",
    signal: target.signal,
  });
  const ogUrl = `${base}/city-og?${ogParams.toString()}`;
  return {
    title: `Airbnb listing optimization in ${target.name}, ${target.state} — Restay`,
    description: `One-time $79 Tune-Up for ${target.name} Airbnb hosts. Rewritten copy, 10 restyled photos, and a 30-day pricing report tuned to the ${target.name} market. Delivered in under 4 hours.`,
    openGraph: {
      title: `Restay Tune-Up for ${target.name} hosts`,
      description: target.marketNote,
      type: "website",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Restay Tune-Up for ${target.name} hosts`,
      description: target.marketNote,
      images: [ogUrl],
    },
  };
}

export default async function HostCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const target = findCity(citySlug);
  if (!target) notFound();

  const samples = await getSampleBeforeAfters("host");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency";

  // City-aggregate stats — best-effort, page renders fine when empty.
  let aggregate: {
    listingCount: number;
    avgPriceCents: number | null;
    avgRating: number | null;
  } | null = null;

  try {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        avgPrice: sql<number | null>`avg(${listings.price})::int`,
        avgRating: sql<number | null>`avg(${listings.avgRating})`,
      })
      .from(listings)
      .where(and(eq(listings.city, target.name), eq(listings.state, target.state)));

    if (rows[0] && rows[0].count > 0) {
      aggregate = {
        listingCount: rows[0].count,
        avgPriceCents: rows[0].avgPrice,
        avgRating: rows[0].avgRating,
      };
    }
  } catch {
    /* fallback */
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "For hosts", item: `${base}/host` },
      {
        "@type": "ListItem",
        position: 3,
        name: `${target.name}, ${target.state}`,
        item: `${base}/host/${target.slug}`,
      },
    ],
  };
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Restay Listing Tune-Up for ${target.name}`,
    serviceType: "Airbnb listing optimization",
    areaServed: { "@type": "City", name: target.name },
    provider: { "@type": "Organization", name: "Restay", url: base },
    offers: {
      "@type": "Offer",
      price: "79.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbSchema, productSchema]),
        }}
      />

      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-20">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            For Airbnb hosts in {target.name}, {target.state} · Delivered in under 4 hours
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Tune up your {target.name} Airbnb listing.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            {target.marketNote}
          </p>
          <div className="mt-8">
            <SelfServeForm fixedServiceId="listing-tune-up" />
            <p className="mt-3 text-xs text-muted-foreground">
              Edit-only photos · No subscription · No PMS lock-in
            </p>
            <p className="mt-4 text-sm">
              Want a free score first?{" "}
              <Link href={`/grade/${target.slug}`} className="font-semibold text-primary underline">
                Grade your {target.name} listing →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            What we tune for the {target.name} market.
          </h2>
          <p className="mt-3 text-muted-foreground">
            The {target.name} comp set rewards specific signals more than others.
            We lead the rewrite with: <strong>{target.signal}</strong>.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-4xl font-bold tracking-tight text-primary">Copy</div>
              <p className="text-sm text-muted-foreground">
                Title rewritten to lead with {target.signal}. Description split into Hook / Proof / Call paragraphs and tuned to {target.name} guest-search intent.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-4xl font-bold tracking-tight text-primary">Photos</div>
              <p className="text-sm text-muted-foreground">
                10 of your photos restyled — declutter, relight, color, sky replace. Edit-only (Airbnb policy compliant). Originals retained.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-4xl font-bold tracking-tight text-primary">Pricing</div>
              <p className="text-sm text-muted-foreground">
                30-day weekday/weekend rate calendar based on 50+ comp listings within 1km of your address in {target.name}.
              </p>
            </CardContent>
          </Card>
        </div>

        {aggregate && (
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-3">
            {aggregate.avgPriceCents && (
              <Card>
                <CardContent className="space-y-1 p-5 text-center">
                  <div className="text-3xl font-bold">
                    ${Math.round(aggregate.avgPriceCents / 100)}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {target.name} avg nightly rate
                  </div>
                </CardContent>
              </Card>
            )}
            {typeof aggregate.avgRating === "number" && (
              <Card>
                <CardContent className="space-y-1 p-5 text-center">
                  <div className="text-3xl font-bold">{aggregate.avgRating.toFixed(2)}★</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Comp set avg rating
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="space-y-1 p-5 text-center">
                <div className="text-3xl font-bold">{aggregate.listingCount}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {target.name} listings indexed
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {samples.length > 0 && (
        <section className="container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Drag the slider.</h2>
            <p className="mt-3 text-muted-foreground">
              Same source photo on the left, our edit on the right — same pipeline that runs on your {target.name} listing.
            </p>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {samples.map((s) => (
              <div key={s.id} className="space-y-2">
                <BeforeAfterComparator beforeUrl={s.before} afterUrl={s.after} />
                <p className="text-sm text-muted-foreground">{s.caption}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="pricing" className="border-t bg-muted/30 py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pricing.</h2>
            <p className="mt-3 text-muted-foreground">
              One-time per listing. No subscription, no per-photo fees.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="space-y-2 p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Listing Tune-Up
                </div>
                <div className="text-3xl font-bold">$79</div>
                <p className="text-sm text-muted-foreground">
                  Rewritten title + description, 10 edited photos, 30-day pricing report.
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardContent className="space-y-2 p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Premium
                </div>
                <div className="text-3xl font-bold">$149</div>
                <p className="text-sm text-muted-foreground">
                  Tune-Up + A/B title, 20 photos, seasonal pricing calendar.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rush
                </div>
                <div className="text-3xl font-bold">$129</div>
                <p className="text-sm text-muted-foreground">
                  Standard with priority queue. 24-hour turnaround.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <FAQ audience="host" />
        </div>
      </section>

      <section className="border-t bg-muted/30 py-12">
        <div className="container max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Other markets we serve.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
            {CITY_TARGETS.filter((c) => c.slug !== target.slug)
              .slice(0, 18)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/host/${c.slug}`}
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
