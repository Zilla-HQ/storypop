import { db, listings } from "@/db";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminListingsPage() {
  const rows = await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(200);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Listings</h1>
        <p className="text-sm text-muted-foreground">
          Last 200 scraped. Scores are 1-5 (photo) and 1-5 (agent value).
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Address</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Photo</TableHead>
            <TableHead className="text-right">Agent</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead>Qualified</TableHead>
            <TableHead>Agent email</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.address}, {r.city} {r.state}
              </TableCell>
              <TableCell className="capitalize">{r.source}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(r.price)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.photoScore?.toFixed(1) ?? "–"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.agentValueScore?.toFixed(1) ?? "–"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.targetScore?.toFixed(2) ?? "–"}
              </TableCell>
              <TableCell>
                {r.qualified ? (
                  <Badge variant="success">yes</Badge>
                ) : (
                  <Badge variant="secondary">{r.qualificationReason ?? "no"}</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.agentEmail ?? "–"}
              </TableCell>
              <TableCell>
                <Link
                  className="text-xs text-primary hover:underline"
                  href={`/l/${r.slug}`}
                >
                  view
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No listings yet. Trigger discovery manually from Inngest dev server.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
