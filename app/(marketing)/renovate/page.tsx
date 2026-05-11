import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";
import { FAQ } from "@/components/marketing/faq";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { AddressMockupForm } from "@/components/marketing/address-mockup-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSampleBeforeAfters } from "@/lib/samples";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Realscale — see your home's potential" };

export default async function RenovatePage() {
  const samples = await getSampleBeforeAfters("renovate");
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-emerald-50/40 py-20">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            For homeowners · Free mockups · No signup
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            See your home with a pool, solar, or new curb appeal.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Type your address. We render the mockup against an actual satellite view of
            your property in 90 seconds. Free. If you decide to build, we connect you
            with vetted local contractors — they pay our referral fee, your quote is
            unchanged.
          </p>
          <div className="mt-8">
            <AddressMockupForm />
            <p className="mt-3 text-xs text-muted-foreground">
              Pick a service above and enter your home's address. We use Mapbox satellite,
              not your listing.
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works.</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Enter your address",
              body: "We geocode it and pull a fresh satellite tile of your lot.",
            },
            {
              step: "2",
              title: "AI renders the mockup",
              body: "Pool, solar panels, or curb appeal — added to your actual property in ~90 seconds.",
            },
            {
              step: "3",
              title: "Get matched, no charge",
              body: "Like what you see? Tell us your budget + timeline; we introduce 2–3 vetted local contractors within 24 hours.",
            },
          ].map((s) => (
            <Card key={s.step}>
              <CardContent className="space-y-2 p-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-700">
                  {s.step}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="samples" className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Drag the slider.</h2>
          <p className="mt-3 text-muted-foreground">
            For pool and solar, we render against an actual satellite tile of the property
            — not a stock photo. Drag to compare.
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

      <section id="services" className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">What you can render, free.</h2>
          <p className="mt-3 text-muted-foreground">
            Pick a service. Enter your address. 90 seconds later you'll have a personalized
            mockup with cost + value-lift estimates for your zip.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-6xl">
          <ServicesGrid audience="renovate" />
        </div>
      </section>

      <section id="pricing" className="border-t bg-muted/30 py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">How we make money.</h2>
            <p className="mt-3 text-muted-foreground">
              The mockup is free. If you decide to move forward, we connect you to a
              vetted local contractor. They pay our referral fee — your quote is the
              same as if you went direct.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl">
            <Card className="border-emerald-500/40">
              <CardContent className="grid gap-6 p-8 md:grid-cols-3">
                {[
                  "Mockup + value-lift estimate",
                  "Vetted contractor introductions",
                  "Quotes &amp; consultations",
                ].map((label) => (
                  <div key={label} className="flex flex-col items-center text-center">
                    <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-600" />
                    <div className="text-2xl font-bold">$0</div>
                    <p className="mt-1 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: label }} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              You only pay your contractor for the actual work, at their normal rate.
              Realscale earns a referral fee from the contractor when a project closes.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <FAQ audience="renovate" />
        </div>
      </section>
    </>
  );
}
