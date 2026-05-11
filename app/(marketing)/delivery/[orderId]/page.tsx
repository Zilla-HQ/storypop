import { notFound } from "next/navigation";
import { db, orders, listings, previews } from "@/db";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Share2 } from "lucide-react";
import { shortAddress } from "@/lib/utils";
import { TrackPurchase } from "@/components/marketing/track-purchase";

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DeliveryPage({ params }: PageProps) {
  const { orderId } = await params;

  const [row] = await db
    .select({ order: orders, listing: listings })
    .from(orders)
    .innerJoin(listings, eq(orders.listingId, listings.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) notFound();
  const { order, listing } = row;

  const [preview] = await db
    .select()
    .from(previews)
    .where(eq(previews.listingId, listing.id))
    .orderBy(desc(previews.createdAt))
    .limit(1);

  const deliveredPhotos: string[] = preview?.enhancedPhotoUrls ?? [];

  return (
    <div className="container max-w-6xl py-10">
      <TrackPurchase
        orderId={order.id}
        amountCents={order.amountCents}
        listingId={listing.id}
        status={order.status}
        tier={order.tier}
      />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-600">
            Delivered
          </div>
          <h1 className="text-3xl font-bold">{shortAddress(listing.address)}</h1>
          <p className="text-sm text-muted-foreground">
            {listing.address}, {listing.city}, {listing.state} {listing.zip}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{deliveredPhotos.length} photos</Badge>
          {order.zipUrl && (
            <Button asChild>
              <a href={order.zipUrl} download>
                <Download className="mr-2 h-4 w-4" />
                Download zip
              </a>
            </Button>
          )}
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {order.status !== "fulfilled" && (
        <Card className="mb-6 border-amber-500/40 bg-amber-50">
          <CardContent className="p-4 text-sm">
            Your photos are being enhanced right now. This page will auto-populate as they're
            delivered. ETA: under 2 hours from payment.
          </CardContent>
        </Card>
      )}

      {deliveredPhotos.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No photos yet. Check back soon — or refresh this page.
          </CardContent>
        </Card>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {deliveredPhotos.map((url, i) => (
            <div key={i} className="mb-4 break-inside-avoid overflow-hidden rounded-lg border">
              <img src={url} alt={`Enhanced photo ${i + 1}`} className="w-full" />
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        All staged photos are stamped "Virtually Staged" per NAR guidance. Originals are deleted
        30 days after delivery. Enhanced photos are yours to keep.
      </p>
    </div>
  );
}
