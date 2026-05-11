import { db, listings, outreachEvents, contractorLeads, messages } from "@/db";
import { desc, eq, sql, isNotNull, asc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmt(d: Date | null | undefined) {
  if (!d) return "–";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminContactsPage() {
  // ============ Realtors (from listings + outreach_events) ============
  // One row per agent_email. Aggregate: listings touched, emails sent,
  // first/last contact, opens/clicks/replies.
  const realtorRows = await db
    .select({
      agentEmail: listings.agentEmail,
      agentName: sql<string | null>`max(${listings.agentName})`,
      brokerage: sql<string | null>`max(${listings.brokerage})`,
      agentPhone: sql<string | null>`max(${listings.agentPhone})`,
      listingCount: sql<number>`count(distinct ${listings.id})`.mapWith(Number),
      sentCount: sql<number>`count(${outreachEvents.id}) filter (where ${outreachEvents.sentAt} is not null)`.mapWith(
        Number,
      ),
      openedCount: sql<number>`count(${outreachEvents.id}) filter (where ${outreachEvents.firstOpenedAt} is not null)`.mapWith(
        Number,
      ),
      clickedCount: sql<number>`count(${outreachEvents.id}) filter (where ${outreachEvents.firstClickedAt} is not null)`.mapWith(
        Number,
      ),
      repliedCount: sql<number>`count(${outreachEvents.id}) filter (where ${outreachEvents.repliedAt} is not null)`.mapWith(
        Number,
      ),
      lastContactedAt: sql<Date | null>`max(${outreachEvents.sentAt})`,
      latestListingSlug: sql<string | null>`(
        select ${listings.slug} from ${listings} l2
        where l2.agent_email = ${listings.agentEmail}
        order by l2.created_at desc limit 1
      )`,
    })
    .from(listings)
    .leftJoin(outreachEvents, eq(outreachEvents.listingId, listings.id))
    .where(isNotNull(listings.agentEmail))
    .groupBy(listings.agentEmail)
    .orderBy(desc(sql`max(${outreachEvents.sentAt})`))
    .limit(500);

  // ============ Homeowners (from contractor_leads) ============
  const homeownerRows = await db
    .select({
      lead: contractorLeads,
      listingAddress: listings.address,
      listingSlug: listings.slug,
    })
    .from(contractorLeads)
    .leftJoin(listings, eq(listings.id, contractorLeads.listingId))
    .orderBy(desc(contractorLeads.createdAt))
    .limit(500);

  // ============ Inbound replies count per listing (for "replied" indicator) ============
  const replyCountsByListing = await db
    .select({
      listingId: messages.listingId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(messages)
    .where(eq(messages.direction, "inbound"))
    .groupBy(messages.listingId);
  void replyCountsByListing; // available if we want to surface; per-realtor inbound shown via repliedAt

  // ============ Recent inbound messages (last 100) for an "all replies" feed ============
  const recentInbound = await db
    .select({
      m: messages,
      listingAddress: listings.address,
    })
    .from(messages)
    .leftJoin(listings, eq(listings.id, messages.listingId))
    .where(eq(messages.direction, "inbound"))
    .orderBy(desc(messages.createdAt))
    .limit(100);
  void asc; // imported for future use

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Every realtor and homeowner Realscale has reached out to or heard from.
        </p>
      </div>

      <Tabs defaultValue="realtors">
        <TabsList>
          <TabsTrigger value="realtors">
            Realtors ({realtorRows.length})
          </TabsTrigger>
          <TabsTrigger value="homeowners">
            Homeowners ({homeownerRows.length})
          </TabsTrigger>
          <TabsTrigger value="replies">Recent replies ({recentInbound.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="realtors" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Brokerage</TableHead>
                <TableHead className="text-right">Listings</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Replied</TableHead>
                <TableHead>Last contacted</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realtorRows.map((r) => (
                <TableRow key={r.agentEmail ?? "unknown"}>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {r.agentName ?? "(no name)"}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.agentEmail}</div>
                    {r.agentPhone && (
                      <div className="text-xs text-muted-foreground">{r.agentPhone}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.brokerage ?? "–"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.listingCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sentCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.openedCount > 0 ? (
                      <span className="font-medium text-emerald-600">{r.openedCount}</span>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.clickedCount > 0 ? (
                      <span className="font-medium text-emerald-600">{r.clickedCount}</span>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.repliedCount > 0 ? (
                      <span className="font-medium text-emerald-600">{r.repliedCount}</span>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(r.lastContactedAt)}
                  </TableCell>
                  <TableCell>
                    {r.latestListingSlug && (
                      <Link
                        href={`/l/${r.latestListingSlug}`}
                        className="text-xs text-primary hover:underline"
                      >
                        latest listing
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {realtorRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No realtor contacts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="homeowners" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email / phone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {homeownerRows.map(({ lead, listingAddress, listingSlug }) => (
                <TableRow key={lead.id}>
                  <TableCell className="text-sm font-medium">{lead.name}</TableCell>
                  <TableCell className="text-xs">
                    <div>{lead.email}</div>
                    {lead.phone && (
                      <div className="text-muted-foreground">{lead.phone}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.serviceId}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {listingSlug ? (
                      <Link
                        href={`/l/${listingSlug}`}
                        className="hover:underline"
                      >
                        {listingAddress ?? listingSlug}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{lead.budgetBand ?? "–"}</TableCell>
                  <TableCell className="text-xs">{lead.timeline ?? "–"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(lead.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {homeownerRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No homeowner submissions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="replies" className="mt-4 space-y-3">
          {recentInbound.map(({ m, listingAddress }) => (
            <div key={m.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {m.from} → {listingAddress ?? m.listingId.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">{fmt(m.createdAt)}</div>
              </div>
              {m.subject && (
                <div className="mt-1 text-xs text-muted-foreground">{m.subject}</div>
              )}
              <div className="mt-2 flex gap-2">
                {m.classification && (
                  <Badge variant="outline">{m.classification}</Badge>
                )}
                {m.humanFlag && <Badge variant="destructive">flagged</Badge>}
                {m.aiReplyGenerated && <Badge variant="default">auto-replied</Badge>}
              </div>
              {m.bodyText && (
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs">
                  {m.bodyText.slice(0, 1500)}
                </pre>
              )}
            </div>
          ))}
          {recentInbound.length === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No inbound replies yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
