import type { Metadata } from "next";
import { GraderForm } from "@/components/marketing/grader-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Free Airbnb Listing Grader — Restay",
  description:
    "Paste your Airbnb URL. Get a 0–100 grade across copy, photos, and listing signals — plus the 3 highest-impact fixes — in under 10 seconds. Free, no signup.",
  openGraph: {
    title: "Free Airbnb Listing Grader",
    description:
      "Score your Airbnb listing 0–100 across copy, photos, and signals. See the 3 fixes that would lift your bookings the most. Free.",
    type: "website",
  },
};

export const dynamic = "force-static";

export default function GradePage() {
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Free · No signup · 10 seconds
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            How good is your Airbnb listing — really?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Paste your URL. We grade your copy, photos, and listing signals against
            what's working in 2026, and tell you the 3 fixes that would lift bookings
            the most. Free.
          </p>
          <div className="mt-10">
            <GraderForm />
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">What we actually grade.</h2>
          <p className="mt-3 text-muted-foreground">
            Three weighted components. The grader runs the same models that power our
            paid Tune-Up — just on the surface signals, not the full deliverable.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Photos · 45%
              </div>
              <div className="text-2xl font-bold">Vision-scored</div>
              <p className="text-sm text-muted-foreground">
                Claude vision rates 3 of your photos for lighting, framing, color,
                and clutter — then we factor in photo count (under 20 hurts).
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Copy · 35%
              </div>
              <div className="text-2xl font-bold">Conversion-graded</div>
              <p className="text-sm text-muted-foreground">
                Title length and specificity, description depth, hook quality.
                Penalizes generic "Cozy 2BR in [city]" templates.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Signals · 20%
              </div>
              <div className="text-2xl font-bold">Trust + activity</div>
              <p className="text-sm text-muted-foreground">
                Review count, rating, Superhost status, and structural signals
                (description length, title truncation, etc.).
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Why grade for free?</h2>
          <p className="mt-4 text-muted-foreground">
            Our paid Tune-Up ($79 one-time) actually <em>fixes</em> what the grader
            surfaces — rewriting your title and description, restyling 10 photos,
            and producing a 30-day pricing report. The grader is the audit; the
            Tune-Up is the work. We figured if we're going to ship the audit anyway,
            we might as well give it away.
          </p>
        </div>
      </section>
    </>
  );
}
