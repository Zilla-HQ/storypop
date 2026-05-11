import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";
import { FAQ } from "@/components/marketing/faq";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { AddressMockupForm } from "@/components/marketing/address-mockup-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSampleBeforeAfters } from "@/lib/samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "Merchant — [Audience B funnel]" };

export default async function AudienceBPage() {
  const samples = await getSampleBeforeAfters("audience-b");
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-20">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            For [audience B] · [Free / referral framing]
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            [Hero headline for audience B.]
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            [Subhead — describe what audience B gets for free and how the partner referral funnels work.]
          </p>
          <div className="mt-8">
            <AddressMockupForm />
            <p className="mt-3 text-xs text-muted-foreground">
              [Trust line — yours to keep · no signup · we don't sell your info]
            </p>
          </div>
        </div>
      </section>

      <section id="how" className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works.</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          {[
            { n: 1, title: "[Step 1]", body: "[What the customer does.]" },
            { n: 2, title: "[Step 2]", body: "[What the merchant does.]" },
            { n: 3, title: "[Step 3]", body: "[Partner intro / next step.]" },
          ].map((s) => (
            <Card key={s.n}>
              <CardContent className="space-y-2 p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Step {s.n}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
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
            Real before/afters from our pipeline.
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
        <ServicesGrid audience="audience-b" />
      </section>

      <section id="pricing" className="border-t bg-muted/30 py-16">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Pricing.</h2>
          <p className="mt-3 text-muted-foreground">
            [Free + partner referral framing — explain the unit economics in one line.]
          </p>
        </div>
      </section>

      <section id="faq" className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <FAQ audience="audience-b" />
        </div>
      </section>
    </>
  );
}
