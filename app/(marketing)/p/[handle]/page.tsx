import type { Metadata } from "next";
import { GraderForm } from "@/components/marketing/grader-form";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ handle: string }>;
}

// Partner handles are arbitrary (no generateStaticParams) — render on-demand
// then ISR-cache for a day. Lets new partners be added without a deploy.
export const dynamic = "force-dynamic";
export const revalidate = 86400;

function prettify(handle: string): string {
  return handle
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const display = prettify(handle);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency";
  const ogParams = new URLSearchParams({
    title: `${display} × Restay listing grader`,
    category: "Partner",
    minutes: "0",
  });
  return {
    title: `${display} × Restay — Free Airbnb listing grader`,
    description: `Free 0–100 Airbnb listing grader brought to you by ${display} and Restay. 10 seconds, no signup.`,
    openGraph: {
      title: `${display} × Restay — Airbnb listing grader`,
      description: `Free 10-second score on any Airbnb listing.`,
      images: [{ url: `${base}/blog-og?${ogParams.toString()}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${display} × Restay`,
      images: [`${base}/blog-og?${ogParams.toString()}`],
    },
  };
}

export default async function PartnerGraderPage({ params }: PageProps) {
  const { handle } = await params;
  const display = prettify(handle);

  // Set the partner attribution cookie via a tiny redirect-friendly script.
  // The client GraderForm POSTs to /api/grade which reads the cookie set by
  // middleware.ts. By rendering this page with a partner UTM in the URL we
  // ensure the same attribution flow runs.
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-3 rounded-full border bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wider">
            <span className="text-muted-foreground">In partnership with</span>
            <span className="text-foreground">{display}</span>
            <span className="text-muted-foreground">×</span>
            <span className="text-primary">Restay</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Grade your Airbnb listing free.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {display} partnered with us to bring you the same listing grader
            that scores listings 0–100 across photos, copy, and signals — in 10
            seconds. No signup. The full Tune-Up that fixes everything is one-time
            $79.
          </p>
          <div className="mt-10">
            <GraderForm />
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">What we grade.</h2>
          <p className="mt-3 text-muted-foreground">
            Three weighted components. Photos at 45%, copy at 35%, listing
            signals at 20%. Same model behind our $79 Tune-Up — the grader is
            the audit; the Tune-Up is the work.
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
                Claude vision rates 3 of your photos for lighting, framing, color, clutter — plus photo count.
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
                Review count, rating, Superhost status, structural signals.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-10">
        <div className="container max-w-3xl text-center text-sm text-muted-foreground">
          <p>
            This page is hosted by Restay. {display} earns a commission when you
            order a Tune-Up — that's how the partnership works. No effect on
            your price.
          </p>
        </div>
      </section>
    </>
  );
}
