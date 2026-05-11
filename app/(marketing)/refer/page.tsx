import { Card, CardContent } from "@/components/ui/card";
import { Gift, DollarSign, Clock } from "lucide-react";
import { ReferForm } from "./refer-form";
import { REFERRAL_PAYOUT_CENTS } from "@/lib/referral";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-static";
export const metadata = {
  title: "Realscale Affiliate Program — Earn $25 per referred listing",
  description:
    "Refer agents to Realscale and earn $25 per paid listing. 30-day cookie. Generate your code on this page in 5 seconds.",
  alternates: { canonical: "/refer" },
};

export default function ReferPage() {
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-20">
        <div className="container max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <Gift className="h-3.5 w-3.5" />
            Affiliate program
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Earn {formatCents(REFERRAL_PAYOUT_CENTS)} for every agent you send our way.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Drop your email, get a code, share the link. We track every paid listing
            that comes through it for 30 days and pay out monthly via Stripe.
          </p>
          <div className="mt-10">
            <ReferForm />
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 p-6">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              <div className="text-2xl font-bold">{formatCents(REFERRAL_PAYOUT_CENTS)}</div>
              <div className="text-sm font-semibold">Per paid listing</div>
              <p className="text-sm text-muted-foreground">
                Flat payout for every Standard ($89), Premium ($149), or Rush ($199)
                order from a referred agent. Stacks across listings — refer one
                productive agent and the income recurs.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <Clock className="h-6 w-6 text-emerald-600" />
              <div className="text-2xl font-bold">30 days</div>
              <div className="text-sm font-semibold">First-touch cookie</div>
              <p className="text-sm text-muted-foreground">
                The first time an agent clicks your link we drop a 30-day cookie. Even
                if they convert via a cold email or organic search later, the
                attribution stays with you.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-6">
              <Gift className="h-6 w-6 text-emerald-600" />
              <div className="text-2xl font-bold">No fees, no minimums</div>
              <div className="text-sm font-semibold">No tier games</div>
              <p className="text-sm text-muted-foreground">
                One flat payout, no &quot;silver vs platinum,&quot; no 90-day NET pay terms.
                Monthly Stripe Connect transfer once your balance crosses $25.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="container max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight">How it works.</h2>
          <ol className="mt-6 space-y-4 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1. Get your code.</span>{" "}
              Drop your email above. We generate a deterministic code from your email
              (so it never expires or rotates).
            </li>
            <li>
              <span className="font-semibold text-foreground">2. Share the link.</span>{" "}
              Send the link in agent FB groups, your newsletter, your bio, or paste it
              in a Slack DM to that agent who&apos;s always complaining about her listing
              photos.
            </li>
            <li>
              <span className="font-semibold text-foreground">3. We track + pay.</span>{" "}
              Every paid order from a cookied visitor gets your code stamped on it.
              You can see your numbers any time at /refer/dashboard. Monthly payouts
              via Stripe Connect once you cross $25.
            </li>
          </ol>
          <p className="mt-6 text-xs text-muted-foreground">
            Eligible only on first-time customer orders to prevent self-referrals.
            Payouts subject to Realscale&apos;s standard{" "}
            <a href="/terms" className="underline">terms of service</a>.
          </p>
        </div>
      </section>
    </>
  );
}
