import { SelfServeForm } from "@/components/marketing/self-serve-form";

export function Hero() {
  return (
    <section className="border-b bg-gradient-to-b from-background to-muted/30 py-20">
      <div className="container max-w-4xl text-center">
        <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Free preview · 90 seconds · No signup
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Paste your listing.<br />See what it could be.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
          AI mockups for staging, renovations, pools, solar, and curb appeal — built from
          the photos already in your listing. Connect with vetted contractors when you're
          ready to make it real.
        </p>
        <div className="mt-8">
          <SelfServeForm />
          <p className="mt-3 text-xs text-muted-foreground">
            Works with Zillow, Redfin, and Realtor.com URLs. Paid services start at $79.
          </p>
        </div>
      </div>
    </section>
  );
}
