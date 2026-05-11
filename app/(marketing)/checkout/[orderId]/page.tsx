import { notFound } from "next/navigation";
import Link from "next/link";
import { db, orders, listings } from "@/db";
import { eq } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents, shortAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function CheckoutSummaryPage({ params }: PageProps) {
  const { orderId } = await params;

  const [row] = await db
    .select({ order: orders, listing: listings })
    .from(orders)
    .innerJoin(listings, eq(orders.listingId, listings.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) notFound();
  const { order, listing } = row;

  return (
    <div className="container max-w-2xl py-16">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Order #{order.id.slice(0, 8)}
      </div>
      <h1 className="text-3xl font-bold">Checkout — {shortAddress(listing.address)}</h1>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
          <CardDescription>Review before paying.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tier</span>
            <span className="font-medium capitalize">{order.tier}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Style preset</span>
            <span className="font-medium capitalize">{order.stylePreset}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Listing address</span>
            <span className="font-medium text-right">{listing.address}</span>
          </div>
          <div className="flex justify-between border-t pt-4 text-base">
            <span className="font-semibold">Total</span>
            <span className="font-semibold">{formatCents(order.amountCents)}</span>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant={order.status === "paid" ? "success" : "secondary"}>
              {order.status}
            </Badge>
            {order.status === "pending" && (
              <form action="/api/checkout" method="POST">
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit" size="lg">
                  Pay with Stripe
                </Button>
              </form>
            )}
            {order.status === "paid" && order.deliveryUrl && (
              <Button asChild size="lg">
                <Link href={order.deliveryUrl}>View delivery</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
