import { db, outreachEvents, orders, previews } from "@/db";
import { sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FeedEvent {
  at: Date;
  kind: string;
  detail: string;
  tone: "default" | "success" | "warning";
}

export async function LiveFeed() {
  const recentOutreach = await db
    .select({
      at: outreachEvents.createdAt,
      status: outreachEvents.status,
      subject: outreachEvents.subject,
      templateId: outreachEvents.templateId,
    })
    .from(outreachEvents)
    .orderBy(sql`${outreachEvents.createdAt} DESC`)
    .limit(20);

  const recentOrders = await db
    .select({
      at: orders.createdAt,
      status: orders.status,
      amount: orders.amountCents,
      tier: orders.tier,
    })
    .from(orders)
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(20);

  const recentPreviews = await db
    .select({ at: previews.createdAt, listingId: previews.listingId })
    .from(previews)
    .orderBy(sql`${previews.createdAt} DESC`)
    .limit(20);

  const events: FeedEvent[] = [
    ...recentOutreach.map<FeedEvent>((r) => ({
      at: r.at,
      kind: r.templateId === "followup_v1" ? "Follow-up" : "Outreach",
      detail: `${r.status} — ${r.subject ?? ""}`,
      tone:
        r.status === "bounced" || r.status === "complained"
          ? "warning"
          : r.status === "clicked" || r.status === "replied"
            ? "success"
            : "default",
    })),
    ...recentOrders.map<FeedEvent>((r) => ({
      at: r.at,
      kind: "Order",
      detail: `${r.status} · ${r.tier} · $${(r.amount / 100).toFixed(0)}`,
      tone: r.status === "paid" || r.status === "fulfilled" ? "success" : "default",
    })),
    ...recentPreviews.map<FeedEvent>((r) => ({
      at: r.at,
      kind: "Preview",
      detail: `listing ${r.listingId.slice(0, 8)}`,
      tone: "default",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 50);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live feed</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[520px] overflow-y-auto">
        <ul className="divide-y text-sm">
          {events.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              <Badge
                variant={
                  e.tone === "success"
                    ? "success"
                    : e.tone === "warning"
                      ? "destructive"
                      : "secondary"
                }
              >
                {e.kind}
              </Badge>
              <span className="flex-1 truncate">{e.detail}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {e.at.toLocaleTimeString()}
              </span>
            </li>
          ))}
          {events.length === 0 && (
            <li className="py-6 text-center text-muted-foreground">No events yet.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
