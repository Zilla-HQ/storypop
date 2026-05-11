import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";
import { FAQ } from "@/components/marketing/faq";
import { SelfServeForm } from "@/components/marketing/self-serve-form";
import { LiveCounter } from "@/components/marketing/live-counter";
import { Pricing } from "@/components/marketing/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { getSampleBeforeAfters } from "@/lib/samples";
import { getSettings } from "@/db/settings";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Realscale for Agents — listing photo enhancement" };

const STATS = [
  {
    figure: "32%",
    label: "faster sale",
    detail: "Homes with high-quality photos sell 32% faster than those with low-quality photos.",
    source: "Redfin",
  },
  {
    figure: "$11,000",
    label: "more in sale price",
    detail:
      "On homes priced $200k–$1M, professional photography correlates with $3,000–$11,000 higher sale prices.",
    source: "Redfin (50,000+ listings)",
  },
  {
    figure: "118%",
    label: "more online views",
    detail:
      "Listings with professional photos receive 118% more online views than those without.",
    source: "VHT Studios",
  },
  {
    figure: "85%",
    label: "of buyers say photos are #1",
    detail:
      "Homebuyers say photos are the most useful feature on real-estate websites — more than maps, school ratings, or neighborhood info.",
    source: "NAR — Profile of Home Buyers and Sellers",
  },
];

export default async function AgentsPage() {
  const [samples, settings] = await Promise.all([
    getSampleBeforeAfters("agents"),
    getSettings(),
  ]);
  const heroSample = samples[0];
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                For real estate agents · Under 2-hour delivery
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Photos that sell the house, not just show it.
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                Paste any Zillow, Redfin, or Realtor.com URL — we generate a free
                AI-staged before/after so you see exactly what we'd do to your
                listing. Pay only when you order the full set.
              </p>
              <div className="mt-7">
                <SelfServeForm fixedServiceId="photo-staging" />
                <p className="mt-3 text-xs text-muted-foreground">
                  Free preview · No signup · NAR-compliant disclosure stamped on every delivered photo
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <LiveCounter />
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Built for solo agents and small teams · <span className="font-semibold text-foreground">14-day refund guarantee</span>
                </span>
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

      <section id="why" className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Photo quality moves the price.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Don't take our word for it — the data on listing photos is unambiguous.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <Card key={s.figure} className="overflow-hidden">
              <CardContent className="space-y-2 p-6">
                <div className="text-4xl font-bold tracking-tight text-primary">
                  {s.figure}
                </div>
                <div className="text-sm font-semibold">{s.label}</div>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
                <div className="pt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Source: {s.source}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="samples" className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Drag the slider.</h2>
          <p className="mt-3 text-muted-foreground">
            Same source photo on the left, our edit on the right — every "after" was
            generated by the exact pipeline that runs on your listing.
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

      <section id="pricing" className="border-t bg-muted/30 py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pricing.</h2>
            <p className="mt-3 text-muted-foreground">
              Pay once per listing. No subscriptions, no per-photo fees.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-5xl">
            <Pricing
              pricing={{
                standard: settings.pricingStandardCents,
                premium: settings.pricingPremiumCents,
                rush: settings.pricingRushCents,
              }}
              ctaHref="#top"
              ctaLabel="Get started"
            />
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Want to see your listing first?{" "}
              <Link href="#top" className="font-medium underline">
                Paste a URL above
              </Link>
              {" "}— preview is free, you only pay when you order.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <FAQ audience="agents" />
        </div>
      </section>
    </>
  );
}
