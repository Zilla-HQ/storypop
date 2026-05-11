import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import Link from "next/link";
import { db, listings, previews } from "@/db";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { renderPostcard } from "@/lib/lob";
import { getService } from "@/lib/services";
import { shortAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ listingId: string }>;
}

export default async function PostcardPreviewPage({ params }: PageProps) {
  const { listingId } = await params;

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) notFound();

  const [preview] = await db
    .select()
    .from(previews)
    .where(eq(previews.listingId, listingId))
    .orderBy(desc(previews.createdAt))
    .limit(1);

  if (!preview || preview.enhancedPhotoUrls.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/admin/postcards" className="text-sm text-primary hover:underline">
          ← Back
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No preview generated for this listing yet — can't render a postcard.
          </CardContent>
        </Card>
      </div>
    );
  }

  const service = getService(preview.serviceId);

  const { front, back } = await renderPostcard({
    listingId: listing.id,
    to: {
      name: listing.agentName ?? "Current Resident",
      streetLine1: listing.address,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
    },
    listingSlug: listing.slug,
    serviceId: preview.serviceId,
    serviceName: service?.name ?? "Realscale",
    shortAddress: shortAddress(listing.address),
    beforeImageUrl: preview.originalPhotoUrls[0],
    afterImageUrl: preview.enhancedPhotoUrls[0],
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/postcards" className="text-sm text-primary hover:underline">
        ← Back
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{shortAddress(listing.address)}</h1>
        <p className="text-sm text-muted-foreground">
          {listing.address}, {listing.city}, {listing.state} {listing.zip}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>{service?.name ?? preview.serviceId}</Badge>
          <Badge variant="outline">listing slug: {listing.slug}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Front (image side)</h2>
              <span className="text-xs text-muted-foreground">6×4 in</span>
            </div>
            <iframe
              srcDoc={front}
              title="Postcard front"
              className="h-[400px] w-[600px] max-w-full rounded border bg-white"
              sandbox=""
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Back (message + QR side)</h2>
              <span className="text-xs text-muted-foreground">6×4 in</span>
            </div>
            <iframe
              srcDoc={back}
              title="Postcard back"
              className="h-[400px] w-[600px] max-w-full rounded border bg-white"
              sandbox=""
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <div className="font-semibold">CTA target</div>
          <div className="font-mono text-xs">
            {env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!}/l/{listing.slug}
            ?utm_source=postcard&utm_campaign={preview.serviceId}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <a href={`/l/${listing.slug}`} target="_blank" rel="noreferrer">
              Open the landing page →
            </a>
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        This is the same HTML Lob will render to PDF and print. To send a real test postcard
        through Lob (still test mode — won't print or mail), flip{" "}
        <code>relist.admin_settings.mailer_enabled = true</code> and re-fire{" "}
        <code>preview/ready</code> for this listing.
      </p>
    </div>
  );
}
