import { Card, CardContent } from "@/components/ui/card";
import { FAQ } from "@/components/marketing/faq";
import { SelfServeForm } from "@/components/marketing/self-serve-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restay for Property Managers — bulk Airbnb optimization" };

export default function ManagerPage() {
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-20">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            For property managers · 10+ listings
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            One sweep across your whole portfolio.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Batch-optimize copy, photos, and pricing across every listing you manage.
            30% off the single-listing rate at 10+ listings; bigger discounts above 50.
            We integrate with most PMS exports — drop us a CSV of URLs, get back your
            full optimization set.
          </p>
          <div className="mt-8">
            <SelfServeForm fixedServiceId="listing-tune-up" ctaLabel="Try one listing first" />
            <p className="mt-3 text-xs text-muted-foreground">
              Edit-only photos · Airbnb-compliant · No PMS replacement
            </p>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">How portfolio pricing works.</h2>
          <p className="mt-3 text-muted-foreground">
            One-time per listing — no monthly contract. Volume discount stacks
            automatically when you submit multiple listings together.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                10–24 listings
              </div>
              <div className="text-3xl font-bold">$55<span className="text-base font-normal text-muted-foreground">/ea</span></div>
              <p className="text-sm text-muted-foreground">
                30% off retail. Same Tune-Up scope per listing.
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardContent className="space-y-2 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                25–99 listings
              </div>
              <div className="text-3xl font-bold">$45<span className="text-base font-normal text-muted-foreground">/ea</span></div>
              <p className="text-sm text-muted-foreground">
                43% off. Includes a portfolio dashboard with side-by-side originals.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                100+ listings
              </div>
              <div className="text-3xl font-bold">Custom</div>
              <p className="text-sm text-muted-foreground">
                Reach out — most managers at this scale want quarterly re-runs and a
                dedicated billing arrangement.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <FAQ audience="manager" />
        </div>
      </section>
    </>
  );
}
