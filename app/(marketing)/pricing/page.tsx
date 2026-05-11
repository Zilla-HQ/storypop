import { SubscribeButton } from "@/components/subscribe-button";
import { SERVICES } from "@/lib/services";

export const dynamic = "force-static";

export default function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ siteId?: string }>;
}) {
  return <PricingPageInner searchParamsPromise={searchParams ?? Promise.resolve({})} />;
}

async function PricingPageInner({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ siteId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const siteId = searchParams.siteId;
  const monthly = SERVICES.find((s) => s.id === "seo-monitor-monthly")!;
  const annual = SERVICES.find((s) => s.id === "seo-monitor-annual")!;

  return (
    <section className="py-20">
      <div className="container max-w-4xl text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Pricing
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Pick a cadence. We do the rest.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Same audit either way. We re-run it every Monday and only email you when something
          regresses.
        </p>
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          ✓ First 14 days free on monthly. No charge today. Cancel before day 15.
        </p>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
          <PlanCard
            name="Monthly"
            priceCents={monthly.basePriceCents}
            interval="month"
            description={monthly.shortDescription}
            siteId={siteId}
            plan="seo-monitor-monthly"
          />
          <PlanCard
            name="Annual"
            priceCents={annual.basePriceCents}
            interval="year"
            description={annual.shortDescription}
            siteId={siteId}
            plan="seo-monitor-annual"
            highlight
          />
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          Cancel anytime. Refunds pro-rated.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  name,
  priceCents,
  interval,
  description,
  siteId,
  plan,
  highlight,
}: {
  name: string;
  priceCents: number;
  interval: "month" | "year";
  description: string;
  siteId?: string;
  plan: "seo-monitor-monthly" | "seo-monitor-annual";
  highlight?: boolean;
}) {
  const dollars = (priceCents / 100).toFixed(0);
  return (
    <div
      className={`rounded-xl border bg-card p-8 text-left ${
        highlight ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10" : ""
      }`}
    >
      <h2 className="text-2xl font-bold">{name}</h2>
      <div className="mt-2">
        <span className="text-4xl font-extrabold">${dollars}</span>
        <span className="text-muted-foreground"> / {interval}</span>
      </div>
      <p className="mt-3 min-h-[3em] text-sm text-muted-foreground">{description}</p>
      <ul className="mt-6 space-y-2 text-sm">
        {plan === "seo-monitor-monthly" ? (
          <li className="font-semibold text-emerald-700">✓ Free for 14 days, then ${dollars}/mo</li>
        ) : null}
        <li>✓ Weekly automated re-audit</li>
        <li>✓ Email alert only on regression</li>
        <li>✓ Score history + per-check trend</li>
        <li>✓ Cancel any time</li>
      </ul>
      <div className="mt-6">
        <SubscribeButton siteId={siteId} plan={plan} />
      </div>
    </div>
  );
}
