import { db, outreachEvents, listings } from "@/db";
import { desc, eq } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

function statusTone(s: string): "success" | "destructive" | "secondary" | "default" {
  if (s === "clicked" || s === "replied" || s === "opened") return "success";
  if (s === "bounced" || s === "complained" || s === "unsubscribed" || s === "failed")
    return "destructive";
  if (s === "sent" || s === "delivered") return "default";
  return "secondary";
}

function fmt(d: Date | null) {
  if (!d) return "–";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminOutreachPage() {
  const rows = await db
    .select({
      event: outreachEvents,
      listingAddress: listings.address,
      listingSlug: listings.slug,
      agentEmail: listings.agentEmail,
      agentName: listings.agentName,
    })
    .from(outreachEvents)
    .leftJoin(listings, eq(outreachEvents.listingId, listings.id))
    .orderBy(desc(outreachEvents.createdAt))
    .limit(300);

  function preview(body: string | null): string {
    if (!body) return "";
    return body.replace(/\s+/g, " ").trim().slice(0, 140);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Outreach</h1>
        <p className="text-sm text-muted-foreground">
          Last 300 outbound emails. Click any row to see the full body + reply thread.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Opened</TableHead>
            <TableHead className="text-center">Clicked</TableHead>
            <TableHead className="text-center">Replied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ event, listingAddress, agentEmail, agentName }) => (
            <TableRow key={event.id} className="cursor-pointer">
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                <Link href={`/admin/outreach/${event.id}`} className="block hover:underline">
                  {fmt(event.createdAt)}
                </Link>
              </TableCell>
              <TableCell className="text-xs">
                <Link href={`/admin/outreach/${event.id}`} className="block hover:underline">
                  {agentName ? (
                    <>
                      <div className="font-medium text-foreground">{agentName}</div>
                      <div className="text-muted-foreground">{agentEmail ?? "–"}</div>
                    </>
                  ) : (
                    agentEmail ?? "–"
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-xs">
                <Link href={`/admin/outreach/${event.id}`} className="block hover:underline">
                  {listingAddress ?? event.listingId.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell className="max-w-md text-sm">
                <Link href={`/admin/outreach/${event.id}`} className="block hover:underline">
                  <div className="truncate font-medium">{event.subject ?? "–"}</div>
                  {event.body && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {preview(event.body)}
                    </div>
                  )}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={statusTone(event.status)}>{event.status}</Badge>
              </TableCell>
              <TableCell className="text-center text-xs">
                {event.firstOpenedAt ? (
                  <span className="text-emerald-600">{fmt(event.firstOpenedAt)}</span>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </TableCell>
              <TableCell className="text-center text-xs">
                {event.firstClickedAt ? (
                  <span className="text-emerald-600">{fmt(event.firstClickedAt)}</span>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </TableCell>
              <TableCell className="text-center text-xs">
                {event.repliedAt ? (
                  <span className="text-emerald-600">{fmt(event.repliedAt)}</span>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No outreach yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
