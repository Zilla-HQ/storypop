import { notFound, redirect } from "next/navigation";
import { db, listings, previews } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";
import { FAQ } from "@/components/marketing/faq";
import { RenovationOpportunities } from "@/components/marketing/renovation-opportunities";
import { ContractorLeadForm } from "@/components/marketing/contractor-lead-form";
import { Card, CardContent } from "@/components/ui/card";
import { PersonalizedCheckout } from "./personalized-checkout";
import { RecentStagesGallery } from "@/components/marketing/recent-stages-gallery";
import { shortAddress } from "@/lib/utils";
import { getSettings } from "@/db/settings";
import { getService, DEFAULT_SERVICE_ID } from "@/lib/services";
import { inngest } from "@/inngest/client";

// Always render fresh — listings transition from stub to ready in real time.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ listingSlug: string }>;
  searchParams: Promise<{ service?: string }>;
}

export default async function PersonalizedLandingPage({ params, searchParams }: PageProps) {
  const { listingSlug } = await params;
  const { service: requestedServiceRaw } = await searchParams;

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.slug, listingSlug))
    .limit(1);

  if (!listing) notFound();

  // If the URL requests a specific service (e.g. /l/<slug>?service=pool-mockup),
  // honor it — find the matching preview, not just the latest.
  const requestedService = requestedServiceRaw ? getService(requestedServiceRaw) : undefined;

  let preview = requestedService
    ? (
        await db
          .select()
          .from(previews)
          .where(
            and(eq(previews.listingId, listing.id), eq(previews.serviceId, requestedService.id)),
          )
          .orderBy(desc(previews.createdAt))
          .limit(1)
      )[0]
    : undefined;

  // No preview for the requested service yet? Fire its generation now and
  // send the visitor to the loading page. Fall back to the latest preview
  // if no service was requested.
  if (requestedService && !preview) {
    // Pay-on-intent: this click is the trigger to spend on fal.ai for THIS
    // recipient. Fire preview/requested (not listings/qualified — that
    // would also kick outreach again).
    await inngest.send({
      name: "preview/requested",
      data: { listingId: listing.id, serviceId: requestedService.id },
    });
    redirect(`/generating/${listing.id}?service=${requestedService.id}`);
  }
  if (!preview) {
    preview = (
      await db
        .select()
        .from(previews)
        .where(eq(previews.listingId, listing.id))
        .orderBy(desc(previews.createdAt))
        .limit(1)
    )[0];
  }
  // No service requested + no preview at all yet → first cold-email click.
  // Fire preview/requested for the default photo-staging service and send
  // the visitor to /generating to wait it out.
  if (!preview) {
    await inngest.send({
      name: "preview/requested",
      data: { listingId: listing.id, serviceId: DEFAULT_SERVICE_ID },
    });
    redirect(`/generating/${listing.id}`);
  }

  const service =
    getService(preview?.serviceId ?? DEFAULT_SERVICE_ID) ?? getService(DEFAULT_SERVICE_ID)!;
  const isRenovate = service.audience === "renovate";
  const needsMlsPhotos = service.imageSource !== "satellite_tile";

  const isStub =
    listing.address === "Loading…" ||
    !listing.address ||
    (needsMlsPhotos && listing.photos.length === 0) ||
    !preview ||
    preview.enhancedPhotoUrls.length === 0;
  if (isStub) {
    redirect(`/generating/${listing.id}${requestedService ? `?service=${requestedService.id}` : ""}`);
  }

  const settings = await getSettings();
  const isFree = service.basePriceCents === 0;

  const totalPhotos = listing.photos?.length ?? 0;
  const previewCount = preview!.enhancedPhotoUrls.length;

  return (
    <div className="py-10">
      <section className="container max-w-5xl">
        <div className="mb-4 text-sm font-semibold uppercase tracking-wider text-emerald-600">
          {service.name} preview · ready
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Here's what {shortAddress(listing.address)} could look like.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {previewCount} sample{previewCount === 1 ? "" : "s"} from our actual pipeline —
          drag any slider to compare. Order below to get all{" "}
          {totalPhotos > 0 ? totalPhotos : "your listing's"} photos enhanced in under 2 hours.
        </p>
        {!isFree && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#pricing"
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Order the full set →
            </a>
            <span className="text-xs text-muted-foreground">
              From {(settings.pricingStandardCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} ·
              Under 2-hour delivery · 14-day refund guarantee
            </span>
          </div>
        )}
      </section>

      <section className="container mt-10 max-w-5xl">
        <div className="grid gap-6 md:grid-cols-2">
          {preview!.originalPhotoUrls.map((before, i) => {
            const after = preview!.enhancedPhotoUrls[i];
            if (!after) return null;
            return (
              <BeforeAfterComparator
                key={i}
                beforeUrl={before}
                afterUrl={after}
                className="aspect-[4/3]"
              />
            );
          })}
        </div>
        {!isFree && (
          <div className="mt-8 rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
            <p className="text-lg font-semibold">
              Like what you see?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              These are 2 of {totalPhotos > 0 ? totalPhotos : "your"} photos. Pick a tier below
              to enhance the rest — same pipeline, same quality.
            </p>
            <a
              href="#pricing"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              See pricing ↓
            </a>
          </div>
        )}
      </section>

      {listing.floorplanRecommendations &&
        listing.floorplanRecommendations.recommendations.length > 0 && (
          <RenovationOpportunities
            bedroomCount={listing.floorplanRecommendations.bedroomCount}
            bathroomCount={listing.floorplanRecommendations.bathroomCount}
            recommendations={listing.floorplanRecommendations.recommendations}
            floorplanSourceUrl={listing.floorplanSourceUrl}
          />
        )}

      {/* Contractor funnel — for free renovation services on the homeowner side */}
      {isRenovate && isFree && (
        <section className="container mt-16 max-w-3xl">
          <div className="text-center">
            <div className="mb-2 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Like it? Get matched
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Ready to make this real?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us a bit about your timeline and budget — we'll connect you with 2–3
              vetted local {service.name.toLowerCase()} contractors within 24 hours. The
              mockup and the introductions are free.
            </p>
          </div>
          <Card className="mt-8 border-emerald-500/40">
            <CardContent className="p-6 sm:p-8">
              <ContractorLeadForm
                listingId={listing.id}
                serviceId={service.id}
                serviceName={service.name}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Photo-staging / paid services — show the Stripe checkout block */}
      {!isFree && (
        <section className="container mt-12 max-w-5xl scroll-mt-8 rounded-2xl bg-muted/40 py-12" id="pricing">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Order in under 60 seconds
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Order the full set.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Full refund within 14 days if you don't love it. NAR-compliant
              "Virtually Staged" disclosure stamped on every photo. Pay once
              per listing — no subscriptions.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-5xl px-4">
            <PersonalizedCheckout
              listingId={listing.id}
              listingSlug={listing.slug}
              pricing={{
                standard: settings.pricingStandardCents,
                premium: settings.pricingPremiumCents,
                rush: settings.pricingRushCents,
              }}
              stylePresets={settings.stylePresets}
            />
          </div>
          <div className="mt-8 grid gap-4 px-4 text-center text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <div className="font-semibold text-foreground">Under 2 hours</div>
              <div>Most orders deliver in 30–60 min</div>
            </div>
            <div>
              <div className="font-semibold text-foreground">14-day refund</div>
              <div>Full refund if you don't love it</div>
            </div>
            <div>
              <div className="font-semibold text-foreground">NAR-compliant</div>
              <div>"Virtually Staged" disclosure stamped</div>
            </div>
          </div>
        </section>
      )}

      {service.audience === "agents" && (
        <RecentStagesGallery excludeListingId={listing.id} />
      )}

      <section className="container mt-16 max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Common questions.</h2>
        </div>
        <div className="mt-10">
          <FAQ audience={service.audience === "agents" ? "agents" : "renovate"} />
        </div>
      </section>
    </div>
  );
}
