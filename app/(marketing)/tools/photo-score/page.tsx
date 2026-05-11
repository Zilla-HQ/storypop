import { SelfServeForm } from "@/components/marketing/self-serve-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Camera, Sparkles } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-static";
export const metadata = {
  title: "Free Photo Quality Score for Your Zillow Listing | Realscale",
  description:
    "Paste any Zillow, Redfin, or Realtor.com URL and get an instant 1–5 photo quality score with a free AI-staged preview. No signup. Built for agents.",
  alternates: { canonical: "/tools/photo-score" },
  openGraph: {
    title: "Rate My Listing Photos — Free AI Photo Score",
    description:
      "Get an instant 1–5 photo score on any Zillow listing with a free AI-staged preview.",
    type: "website",
  },
};

const SCORE_TIERS = [
  {
    score: "5 / 5",
    label: "Pro photographer",
    body: "Wide-angle, proper lighting, staged or great natural light. Will sell on photos alone.",
    color: "text-emerald-700 bg-emerald-500/10",
    icon: CheckCircle2,
  },
  {
    score: "3-4 / 5",
    label: "Decent but improvable",
    body: "Phone-grade or slightly dated. Virtual staging + twilight conversion typically lifts these listings 2-3 score bands.",
    color: "text-amber-700 bg-amber-500/10",
    icon: Sparkles,
  },
  {
    score: "1-2 / 5",
    label: "Bleeding views",
    body: "Bad framing, harsh light, clutter, dated decor. These listings get scrolled past on Zillow's mobile feed in <1 second.",
    color: "text-rose-700 bg-rose-500/10",
    icon: AlertCircle,
  },
];

export default function PhotoScorePage() {
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Camera className="h-3.5 w-3.5" />
            Free tool for real estate agents
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            How does your listing photography score?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Paste any Zillow, Redfin, or Realtor.com URL. Our vision model rates each
            photo 1–5 and generates a free AI-staged before/after of your worst-performing
            shot. No signup, no email gate.
          </p>
          <div className="mt-9">
            <SelfServeForm
              fixedServiceId="photo-staging"
              ctaLabel="Score my listing photos"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Results in ~90 seconds · Powered by Claude vision · Free
            </p>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">What the score means.</h2>
          <p className="mt-3 text-muted-foreground">
            Same 1–5 rubric we use to qualify cold-outreach targets internally. Calibrated
            against ~100k MLS photos.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
          {SCORE_TIERS.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.score}>
                <CardContent className="space-y-3 p-6">
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${t.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold tracking-tight">{t.score}</div>
                    <div className="text-sm font-semibold">{t.label}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="container max-w-4xl">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                What we do with the listings that score 1–3.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every photo flagged as 3 or below gets a free AI-staged or twilight
                rendition you can compare side-by-side. If you like what you see, the
                full set on a 12–15 photo listing runs $89, delivered in under 2 hours,
                NAR-disclosure stamped.
              </p>
              <Link
                href="/agents"
                className="mt-5 inline-flex font-semibold text-primary underline-offset-2 hover:underline"
              >
                See pricing & samples →
              </Link>
            </div>
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Sample report</div>
                  <div className="text-xs text-muted-foreground">— example</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span>Living room (photo 1)</span>
                    <span className="font-mono text-rose-700">2.0</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Kitchen (photo 3)</span>
                    <span className="font-mono text-amber-700">3.0</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Master bedroom (photo 5)</span>
                    <span className="font-mono text-rose-700">2.0</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Exterior front (photo 7)</span>
                    <span className="font-mono text-amber-700">3.5</span>
                  </div>
                  <div className="flex justify-between pt-1 font-semibold">
                    <span>Listing average</span>
                    <span className="font-mono">2.6 / 5</span>
                  </div>
                </div>
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  In-line with the bottom 35% of MLS listings nationally. Photo staging
                  + twilight typically lifts averages to 4.2+.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Share the score.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Use it in a listing presentation, a conversation with a slow-moving seller,
            or just to gut-check your own portfolio. The score is yours — keep it.
          </p>
        </div>
      </section>
    </>
  );
}
