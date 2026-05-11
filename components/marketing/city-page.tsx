import Link from "next/link";
import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";
import { FAQ } from "@/components/marketing/faq";
import { SelfServeForm } from "@/components/marketing/self-serve-form";
import { AddressMockupForm } from "@/components/marketing/address-mockup-form";
import { Pricing } from "@/components/marketing/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { getSampleBeforeAfters } from "@/lib/samples";
import { requireService } from "@/lib/services";
import type { City } from "@/lib/cities";

/**
 * Shared template for programmatic SEO city pages. Each /[service]/[city]
 * route delegates here so we have one rendering path for all 5 services
 * across 75+ cities (≈ 350 indexed URLs from one component).
 */
export interface CityPageProps {
  city: City;
  /** Service id from lib/services.ts. Drives copy and which form renders. */
  serviceId: "photo-staging" | "twilight-exterior" | "pool-mockup" | "solar-mockup" | "curb-appeal";
}

const COPY: Record<
  CityPageProps["serviceId"],
  {
    eyebrow: (c: City) => string;
    heading: (c: City) => string;
    subhead: (c: City) => string;
    statBlocks: (c: City) => Array<{ figure: string; label: string; detail: string }>;
    audience: "agents" | "renovate";
    sampleSet: "agents" | "renovate";
    faqAudience: "agents" | "renovate";
    pathToPayment: "self-serve" | "address-mockup";
    secondaryCtaHref: string;
    secondaryCtaLabel: string;
  }
> = {
  "photo-staging": {
    eyebrow: (c) =>
      `Virtual staging for ${c.name}, ${c.stateCode} listings · Under 2-hour turnaround`,
    heading: (c) => `Virtual staging for ${c.name} listings.`,
    subhead: (c) =>
      `Paste any Zillow, Redfin, or Realtor.com URL — we'll stage every interior photo on your ${c.name} listing in under two hours. NAR-compliant disclosure stamped on each delivered image. ${c.name} median home value is ~$${c.medianHomePriceK}K; even a 1% lift on photos pays back this entire order ~80×.`,
    statBlocks: (c) => [
      {
        figure: "$11,000",
        label: "more in sale price",
        detail: `Redfin's analysis of 50,000+ listings found professional photography correlates with $3,000–$11,000 higher sale prices on homes in the $200K–$1M range. The average ${c.name} home falls right in that band at ~$${c.medianHomePriceK}K.`,
      },
      {
        figure: "32%",
        label: "faster sale",
        detail: `Homes with high-quality listing photos sell 32% faster. With ${c.name}'s median days-on-market trending in the high teens, that's the difference between a clean close and a price-cut.`,
      },
      {
        figure: "85%",
        label: "of buyers say photos are #1",
        detail:
          "NAR's Profile of Home Buyers and Sellers ranks photos as the most useful feature on real-estate websites — more than maps, school ratings, or neighborhood info combined.",
      },
      {
        figure: "<2 hrs",
        label: "from URL paste to delivery",
        detail: `Traditional virtual staging shops in ${c.name} quote 24–48 hours and $25–$50 per photo. Same caliber of edit, same NAR disclosure, ~80% cheaper.`,
      },
    ],
    audience: "agents",
    sampleSet: "agents",
    faqAudience: "agents",
    pathToPayment: "self-serve",
    secondaryCtaHref: "/agents",
    secondaryCtaLabel: "See all photo services",
  },
  "twilight-exterior": {
    eyebrow: (c) =>
      `Twilight exterior conversions for ${c.name}, ${c.stateCode} · Under 2-hour delivery`,
    heading: (c) => `Twilight exteriors for ${c.name} listings.`,
    subhead: (c) =>
      `Turn the harsh midday MLS shot of your ${c.name} listing's facade into the cinematic golden-hour exterior that drives showings. Sky replacement, warm window glow, soft golden-hour lighting on the facade. Returned in under two hours.`,
    statBlocks: (c) => [
      {
        figure: "118%",
        label: "more online views",
        detail:
          "VHT Studios found listings with high-quality exterior photography receive 118% more online views — a category twilight exteriors dominate on Zillow's hero slot.",
      },
      {
        figure: "<2 hrs",
        label: "from photo to twilight",
        detail: `Most twilight conversions in the ${c.name} market run $40–$80 per photo with 24-hour turnaround. We render in under two hours, charged per listing.`,
      },
      {
        figure: "$49",
        label: "per listing",
        detail:
          "Standalone twilight conversion is included free in the Premium photo-staging tier, or $49 as a one-off when you only need the exterior.",
      },
      {
        figure: "100%",
        label: "geometry-preserving",
        detail:
          "Our pipeline locks the facade geometry, materials, landscaping, and camera angle from the source photo. Sky and lighting change; the building doesn't.",
      },
    ],
    audience: "agents",
    sampleSet: "agents",
    faqAudience: "agents",
    pathToPayment: "self-serve",
    secondaryCtaHref: "/agents",
    secondaryCtaLabel: "See all photo services",
  },
  "pool-mockup": {
    eyebrow: (c) =>
      `Free pool mockups for ${c.name}, ${c.stateCode} homeowners · Rendered on your real backyard`,
    heading: (c) => `See a pool in your ${c.name} backyard — free.`,
    subhead: (c) =>
      `Type your address. We pull a fresh satellite tile of your lot, render a luxury in-ground pool into your real backyard, and estimate the build cost + value lift for ${c.name}, ${c.stateCode}. No signup, no payment. If you want to actually build it, we introduce 2–3 vetted local pool builders — they pay our referral fee, your quote is unchanged.`,
    statBlocks: (c) => [
      {
        figure: "$75K",
        label: "average ${c.name} pool build",
        detail: `In-ground pool builds in ${c.name} typically run $50K–$100K depending on size, decking, and water features. The mockup tells you what fits your lot before you call a builder.`,
      },
      {
        figure: "+$15K",
        label: `to home value in ${c.name}`,
        detail: `In ${c.stateCode}'s climate, an in-ground pool typically lifts home value 5–8%. On a $${c.medianHomePriceK}K home that's $${Math.round(c.medianHomePriceK * 0.06)}K of equity recouped on day one.`,
      },
      {
        figure: "90 sec",
        label: "to a real mockup",
        detail:
          "Most homeowners get a 'maybe' answer after a $200 design consult. We render the pool against an actual satellite view of your lot in 90 seconds. Free.",
      },
      {
        figure: "$0",
        label: "to you",
        detail:
          "Mockup is free. Contractor introductions are free. We earn a referral fee from the contractor when a project closes — you pay the same as if you went direct.",
      },
    ],
    audience: "renovate",
    sampleSet: "renovate",
    faqAudience: "renovate",
    pathToPayment: "address-mockup",
    secondaryCtaHref: "/renovate",
    secondaryCtaLabel: "See all renovation mockups",
  },
  "solar-mockup": {
    eyebrow: (c) =>
      `Free solar mockups for ${c.name}, ${c.stateCode} homeowners · 25-year savings estimate`,
    heading: (c) => `See solar on your ${c.name} roof — free.`,
    subhead: (c) =>
      `Type your address. We pull a satellite view of your roof, render a tasteful solar array on the south-facing sections, and calculate your estimated 25-year savings against ${c.name}'s average utility rate. Free. If the math works, we introduce 2–3 vetted local installers.`,
    statBlocks: (c) => [
      {
        figure: "~$30K",
        label: `25-yr savings in ${c.name}`,
        detail: `Average ${c.stateCode} household pays ~$1,800/yr for electricity. A right-sized residential array typically offsets 80–100% of that — $30K+ over 25 years, even after panel cost.`,
      },
      {
        figure: "30%",
        label: "federal tax credit",
        detail:
          "The Residential Clean Energy Credit refunds 30% of installation cost as a federal tax credit through 2032. Most ${c.stateCode} installers also stack utility rebates on top.",
      },
      {
        figure: "+4.1%",
        label: "to home value",
        detail: `Berkeley Lab found solar adds 4.1% to home sale prices on average. On a $${c.medianHomePriceK}K ${c.name} home that's ~$${Math.round(c.medianHomePriceK * 0.041)}K of recovered equity at sale.`,
      },
      {
        figure: "$0",
        label: "to you",
        detail:
          "Mockup, savings calculation, installer introductions — all free. We earn a referral fee from the installer when a project closes; your install price is unchanged.",
      },
    ],
    audience: "renovate",
    sampleSet: "renovate",
    faqAudience: "renovate",
    pathToPayment: "address-mockup",
    secondaryCtaHref: "/renovate",
    secondaryCtaLabel: "See all renovation mockups",
  },
  "curb-appeal": {
    eyebrow: (c) =>
      `Free curb-appeal mockups for ${c.name}, ${c.stateCode} homes`,
    heading: (c) => `Refresh your ${c.name} curb appeal — see it first.`,
    subhead: (c) =>
      `Type your address. We render a manicured front yard onto a real satellite view of your home — fresh sod, planted beds, mulched borders, clean walkways. Free. If you want to bring it to life, we introduce vetted ${c.name} landscapers.`,
    statBlocks: (c) => [
      {
        figure: "+7%",
        label: "to home value",
        detail: `Michigan State research found upgraded curb appeal lifts home value 5–11%. On a $${c.medianHomePriceK}K ${c.name} home, the midpoint is roughly $${Math.round(c.medianHomePriceK * 0.07)}K of equity from a weekend's landscaping work.`,
      },
      {
        figure: "$3K–$12K",
        label: "typical refresh budget",
        detail: `${c.name} landscapers typically quote $3K for sod + beds and $10K+ for full curb-appeal makeovers including walkway updates and lighting. The mockup shows you what each tier actually buys before you commit.`,
      },
      {
        figure: "90 sec",
        label: "to your mockup",
        detail:
          "We render against an actual top-down satellite tile of your property. No stock images, no compositing — your real lot, your real driveway, the new front yard you could have.",
      },
      {
        figure: "$0",
        label: "to you",
        detail:
          "Mockup, design ideas, contractor intros — free. We earn a referral fee from the landscaper if you go forward; your quote is the same as direct.",
      },
    ],
    audience: "renovate",
    sampleSet: "renovate",
    faqAudience: "renovate",
    pathToPayment: "address-mockup",
    secondaryCtaHref: "/renovate",
    secondaryCtaLabel: "See all renovation mockups",
  },
};

export async function CityPage({ city, serviceId }: CityPageProps) {
  const copy = COPY[serviceId];
  const service = requireService(serviceId);
  const samples = await getSampleBeforeAfters(copy.sampleSet);
  const heroSample = samples[0];
  // City pages use the static defaults from lib/services.ts for pricing
  // copy, not getSettings(). Keeps build-time DB connections sane and
  // pricing changes are infrequent enough that a redeploy to refresh is
  // fine. /agents and /renovate still pull live settings.
  const photoStaging = requireService("photo-staging");
  const twilight = requireService("twilight-exterior");

  // Schema.org Service markup helps Google show the city in the rich
  // snippet for these pages. areaServed is the structural signal that
  // ties the service to the city.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `${service.name} — ${city.name}, ${city.stateCode}`,
    "provider": {
      "@type": "Organization",
      "name": "Realscale",
      "url": "https://realscale.io",
    },
    "areaServed": {
      "@type": "City",
      "name": city.name,
      "containedInPlace": {
        "@type": "State",
        "name": city.state,
      },
    },
    "description": copy.subhead(city),
    "offers":
      service.basePriceCents > 0
        ? { "@type": "Offer", "price": (service.basePriceCents / 100).toFixed(2), "priceCurrency": "USD" }
        : { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {copy.eyebrow(city)}
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                {copy.heading(city)}
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                {copy.subhead(city)}
              </p>
              <div className="mt-7">
                {copy.pathToPayment === "self-serve" ? (
                  <SelfServeForm fixedServiceId={serviceId} />
                ) : (
                  <AddressMockupForm fixedServiceId={serviceId} />
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {copy.audience === "agents"
                    ? "Free preview · No signup · NAR-compliant disclosure stamped on every delivered photo"
                    : `Rendered on a real satellite view of your ${city.name} home · Free · No signup`}
                </p>
              </div>
              <div className="mt-5 text-xs text-muted-foreground">
                <Link href={copy.secondaryCtaHref} className="font-medium underline">
                  {copy.secondaryCtaLabel}
                </Link>
                {" · "}
                Serving {city.name}, {city.state} and the surrounding metro.
              </div>
            </div>
            {heroSample && (
              <div className="lg:pl-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Real output from our pipeline
                </div>
                <BeforeAfterComparator
                  beforeUrl={heroSample.before}
                  afterUrl={heroSample.after}
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {heroSample.caption} — drag the slider to compare.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Why {city.name} {copy.audience === "agents" ? "agents" : "homeowners"} use us.
          </h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {copy.statBlocks(city).map((s) => (
            <Card key={s.figure} className="overflow-hidden">
              <CardContent className="space-y-2 p-6">
                <div className="text-3xl font-bold tracking-tight text-primary">
                  {s.figure}
                </div>
                <div className="text-sm font-semibold">{s.label}</div>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Drag the slider.</h2>
          <p className="mt-3 text-muted-foreground">
            Same source on the left, our edit on the right — every "after" was
            generated by the exact pipeline that runs on your{" "}
            {copy.audience === "agents" ? "listing" : "property"}.
          </p>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {samples.slice(0, 6).map((s) => (
            <div key={s.id} className="space-y-2">
              <BeforeAfterComparator beforeUrl={s.before} afterUrl={s.after} />
              <p className="text-sm text-muted-foreground">{s.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {copy.audience === "agents" && (
        <section className="border-t bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Pricing — pay once per {city.name} listing.
              </h2>
              <p className="mt-3 text-muted-foreground">
                No subscriptions, no per-photo fees. 14-day refund guarantee.
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-5xl">
              <Pricing
                pricing={{
                  standard: photoStaging.basePriceCents,
                  premium: twilight.basePriceCents + photoStaging.basePriceCents,
                  rush: photoStaging.rushPriceCents,
                }}
                ctaHref="#top"
                ctaLabel="Get started"
              />
            </div>
          </div>
        </section>
      )}

      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <FAQ audience={copy.faqAudience} />
        </div>
      </section>
    </>
  );
}
