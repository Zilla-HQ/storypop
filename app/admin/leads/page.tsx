import { db, contractorLeads, contractorIntros, listings } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SERVICES } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const rows = await db
    .select({ lead: contractorLeads, listing: listings })
    .from(contractorLeads)
    .leftJoin(listings, eq(contractorLeads.listingId, listings.id))
    .orderBy(desc(contractorLeads.createdAt))
    .limit(200);

  const leadIds = rows.map((r) => r.lead.id);
  const intros =
    leadIds.length > 0
      ? await db
          .select()
          .from(contractorIntros)
          .where(inArray(contractorIntros.leadId, leadIds))
          .orderBy(contractorIntros.rank)
      : [];
  const introsByLead = new Map<string, typeof intros>();
  for (const i of intros) {
    const arr = introsByLead.get(i.leadId) ?? [];
    arr.push(i);
    introsByLead.set(i.leadId, arr);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Contractor leads</h1>
        <p className="text-sm text-muted-foreground">
          Homeowners who asked to be matched with a contractor after a free renovation
          mockup. The Yelp matching agent fires automatically — top 3 contractors are
          inserted into <code>contractor_intros</code> and emailed to both you and the
          homeowner.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Matched contractors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ lead, listing }) => {
            const svc = SERVICES.find((s) => s.id === lead.serviceId);
            const myIntros = introsByLead.get(lead.id) ?? [];
            return (
              <TableRow key={lead.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {lead.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </TableCell>
                <TableCell>{svc?.name ?? lead.serviceId}</TableCell>
                <TableCell className="text-xs">
                  {listing?.address ?? "—"}
                  <br />
                  <span className="text-muted-foreground">
                    {listing ? `${listing.city}, ${listing.state} ${listing.zip}` : ""}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{lead.name}</div>
                  <div className="text-xs text-muted-foreground">{lead.email}</div>
                  {lead.phone && (
                    <div className="text-xs text-muted-foreground">{lead.phone}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{lead.budgetBand}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{lead.timeline}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lead.status === "matched"
                        ? "success"
                        : lead.status === "no_matches"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {lead.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  {myIntros.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {lead.status === "matched" ? "(none)" : "pending..."}
                    </span>
                  ) : (
                    <ol className="space-y-1 text-xs">
                      {myIntros.map((i) => (
                        <li key={i.id}>
                          <span className="font-medium">{i.contractorName}</span>{" "}
                          <span className="text-muted-foreground">
                            · {i.rating?.toFixed(1) ?? "?"}★ ({i.reviewCount ?? 0})
                          </span>
                          {i.contractorPhone && (
                            <span className="text-muted-foreground"> · {i.contractorPhone}</span>
                          )}
                          {i.contractorUrl && (
                            <>
                              {" "}
                              ·{" "}
                              <a
                                className="text-primary hover:underline"
                                href={i.contractorUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Yelp
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No leads yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
