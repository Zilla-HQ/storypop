import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db, outreachEvents, listings } from "@/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

function fmt(d: Date | null | undefined) {
  if (!d) return "–";
  const ms = Date.now() - d.getTime();
  const hr = Math.round(ms / 1000 / 60 / 60);
  if (hr < 1) return `${Math.round(ms / 1000 / 60)}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function tone(s: string): "success" | "destructive" | "secondary" | "default" {
  if (s === "clicked" || s === "replied" || s === "opened" || s === "delivered")
    return "success";
  if (s === "bounced" || s === "complained" || s === "failed")
    return "destructive";
  if (s === "sent") return "default";
  return "secondary";
}

export async function RecentEmails({ limit = 10 }: { limit?: number }) {
  const rows = await db
    .select({
      id: outreachEvents.id,
      subject: outreachEvents.subject,
      body: outreachEvents.body,
      status: outreachEvents.status,
      sentAt: outreachEvents.sentAt,
      createdAt: outreachEvents.createdAt,
      firstOpenedAt: outreachEvents.firstOpenedAt,
      firstClickedAt: outreachEvents.firstClickedAt,
      repliedAt: outreachEvents.repliedAt,
      senderDomain: outreachEvents.senderDomain,
      address: listings.address,
      agentEmail: listings.agentEmail,
      agentName: listings.agentName,
    })
    .from(outreachEvents)
    .leftJoin(listings, eq(outreachEvents.listingId, listings.id))
    .where(eq(outreachEvents.channel, "email"))
    .orderBy(desc(outreachEvents.createdAt))
    .limit(limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent emails</CardTitle>
        <Link
          href="/admin/outreach"
          className="text-xs text-muted-foreground hover:underline"
        >
          See all →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No emails sent yet.</p>
        )}
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/outreach/${r.id}`}
            className="block rounded-md border p-3 hover:bg-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={tone(r.status)} className="shrink-0">
                    {r.status}
                  </Badge>
                  {r.firstOpenedAt && (
                    <span className="text-emerald-600">opened</span>
                  )}
                  {r.firstClickedAt && (
                    <span className="text-emerald-600">clicked</span>
                  )}
                  {r.repliedAt && (
                    <span className="font-semibold text-emerald-700">replied</span>
                  )}
                  <span>·</span>
                  <span>To {r.agentName ?? r.agentEmail ?? "(unknown)"}</span>
                  <span>·</span>
                  <span>{r.address ?? "—"}</span>
                </div>
                <div className="truncate text-sm font-semibold">
                  {r.subject ?? "(no subject)"}
                </div>
                <div className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {r.body?.replace(/\n+/g, " ").slice(0, 220) ?? "(no body)"}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                {fmt(r.sentAt ?? r.createdAt)}
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
