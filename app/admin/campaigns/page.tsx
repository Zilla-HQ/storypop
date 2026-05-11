import { db, listings, previews } from "@/db";
import { sql, desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignForm } from "./campaign-form";
import { SERVICES, servicesForAudience } from "@/lib/services";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach campaigns — admin" };

export default async function CampaignsIndexPage() {
  // Show recent satellite-mockup previews so admin can see what the campaign generates
  const recent = await db
    .select({
      listingId: previews.listingId,
      previewId: previews.id,
      serviceId: previews.serviceId,
      createdAt: previews.createdAt,
      address: listings.address,
      city: listings.city,
      state: listings.state,
      zip: listings.zip,
      slug: listings.slug,
    })
    .from(previews)
    .innerJoin(listings, eq(listings.id, previews.listingId))
    .where(sql`${previews.serviceId} IN ('pool-mockup', 'solar-mockup', 'curb-appeal')`)
    .orderBy(desc(previews.createdAt))
    .limit(20);

  const renovateServices = servicesForAudience("renovate").filter(
    (s) => s.imageSource === "satellite_tile" || s.imageSource === "exterior_facade",
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Outreach campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a list of property addresses → we geocode each, run the chosen renovation
          mockup against a satellite tile, and (when the mailer is enabled) ship a
          personalized postcard to that property.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">New campaign</h2>
          <CampaignForm services={renovateServices.map((s) => ({ id: s.id, name: s.name }))} />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Recent renovation previews</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Last 20 satellite-mockup or curb-appeal generations across all sources
          (campaigns + organic self-serve).
        </p>
        <div className="mt-4 grid gap-3">
          {recent.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nothing generated yet — kick off a campaign above.
              </CardContent>
            </Card>
          )}
          {recent.map((r) => {
            const svc = SERVICES.find((s) => s.id === r.serviceId);
            return (
              <Card key={r.previewId}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.address}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.city}, {r.state} {r.zip}
                    </div>
                  </div>
                  <Badge variant="secondary">{svc?.name ?? r.serviceId}</Badge>
                  <div className="text-xs text-muted-foreground">
                    {r.createdAt.toLocaleString()}
                  </div>
                  <a
                    className="text-xs text-primary hover:underline"
                    href={`/l/${r.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
