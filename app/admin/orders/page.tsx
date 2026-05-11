import { db, orders, listings } from "@/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCents, shortAddress } from "@/lib/utils";
import { RefundButton } from "./refund-button";

export const dynamic = "force-dynamic";

function statusTone(s: string): "success" | "destructive" | "secondary" | "default" {
  if (s === "fulfilled" || s === "paid") return "success";
  if (s === "refunded" || s === "failed") return "destructive";
  return "default";
}

export default async function AdminOrdersPage() {
  const rows = await db
    .select({ order: orders, listing: listings })
    .from(orders)
    .innerJoin(listings, eq(orders.listingId, listings.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">Last 200 orders.</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Style</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ order, listing }) => (
            <TableRow key={order.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </TableCell>
              <TableCell>{shortAddress(listing.address)}</TableCell>
              <TableCell className="capitalize">{order.tier}</TableCell>
              <TableCell className="capitalize">{order.stylePreset}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(order.amountCents)}</TableCell>
              <TableCell>
                <Badge variant={statusTone(order.status)}>{order.status}</Badge>
              </TableCell>
              <TableCell>
                {order.deliveryUrl ? (
                  <Link className="text-xs text-primary hover:underline" href={order.deliveryUrl}>
                    view
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {order.status === "paid" || order.status === "fulfilled" ? (
                  <RefundButton orderId={order.id} />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No orders yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
