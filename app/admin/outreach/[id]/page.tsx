import { db, outreachEvents, listings, messages } from "@/db";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function fmt(d: Date | null | undefined) {
  if (!d) return "–";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OutreachDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [evt] = await db
    .select()
    .from(outreachEvents)
    .where(eq(outreachEvents.id, id))
    .limit(1);

  if (!evt) notFound();

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, evt.listingId))
    .limit(1);

  // All outreach to this listing (chronological) so the full sequence
  // (cold + 72h follow-up + replied auto-reply) is visible together.
  const allOutreach = await db
    .select()
    .from(outreachEvents)
    .where(eq(outreachEvents.listingId, evt.listingId))
    .orderBy(asc(outreachEvents.createdAt));

  // All inbound + outbound messages for this listing.
  const threadMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.listingId, evt.listingId))
    .orderBy(asc(messages.createdAt));

  // Merge into a single chronological feed.
  type FeedItem =
    | {
        kind: "outreach";
        at: Date;
        subject: string | null;
        body: string | null;
        status: string;
        from: string;
        to: string;
        opened?: Date | null;
        clicked?: Date | null;
        replied?: Date | null;
      }
    | {
        kind: "message";
        at: Date;
        subject: string | null;
        body: string | null;
        direction: "inbound" | "outbound";
        from: string;
        to: string;
        classification: string | null;
        humanFlag: boolean;
      };

  const feed: FeedItem[] = [
    ...allOutreach.map((o): FeedItem => ({
      kind: "outreach",
      at: o.sentAt ?? o.createdAt,
      subject: o.subject,
      body: o.body,
      status: o.status,
      from: o.senderDomain ? `outreach@${o.senderDomain}` : "(unknown)",
      to: listing?.agentEmail ?? "(unknown)",
      opened: o.firstOpenedAt,
      clicked: o.firstClickedAt,
      replied: o.repliedAt,
    })),
    ...threadMessages.map((m): FeedItem => ({
      kind: "message",
      at: m.createdAt,
      subject: m.subject,
      body: m.bodyText ?? m.bodyHtml,
      direction: m.direction,
      from: m.from,
      to: m.to,
      classification: m.classification,
      humanFlag: m.humanFlag,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/outreach" className="text-xs text-muted-foreground hover:underline">
          ← Back to outreach
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {listing?.address ?? "Unknown listing"}
        </h1>
        <div className="text-sm text-muted-foreground">
          Conversation with{" "}
          <span className="font-medium text-foreground">
            {listing?.agentName ?? listing?.agentEmail ?? "(unknown)"}
          </span>
          {listing?.agentEmail && listing.agentName && (
            <span> · {listing.agentEmail}</span>
          )}
        </div>
      </div>

      {/* High-level state */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sent" value={allOutreach.filter((o) => o.sentAt).length.toString()} />
        <Stat
          label="Opened"
          value={allOutreach.filter((o) => o.firstOpenedAt).length.toString()}
        />
        <Stat
          label="Clicked"
          value={allOutreach.filter((o) => o.firstClickedAt).length.toString()}
        />
        <Stat
          label="Replied"
          value={threadMessages.filter((m) => m.direction === "inbound").length.toString()}
        />
      </div>

      {/* Conversation feed */}
      <div className="space-y-3">
        {feed.map((item, i) => (
          <Card
            key={i}
            className={
              item.kind === "message" && item.direction === "inbound"
                ? "border-emerald-500/40 bg-emerald-50/30"
                : ""
            }
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-normal">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {item.kind === "outreach" && (
                      <Badge variant="default">outbound (cold)</Badge>
                    )}
                    {item.kind === "message" && item.direction === "outbound" && (
                      <Badge variant="default">outbound (auto-reply)</Badge>
                    )}
                    {item.kind === "message" && item.direction === "inbound" && (
                      <Badge variant="success">inbound</Badge>
                    )}
                    {item.kind === "message" && item.classification && (
                      <Badge variant="outline">{item.classification}</Badge>
                    )}
                    {item.kind === "message" && item.humanFlag && (
                      <Badge variant="destructive">flagged for human</Badge>
                    )}
                    {item.kind === "outreach" && (
                      <Badge variant="secondary">{item.status}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    From <span className="font-mono">{item.from}</span> → to{" "}
                    <span className="font-mono">{item.to}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {fmt(item.at)}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.subject && (
                <div className="text-sm font-semibold">{item.subject}</div>
              )}
              {item.body ? (
                <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
                  {item.body}
                </pre>
              ) : (
                <div className="text-xs italic text-muted-foreground">
                  (no body recorded)
                </div>
              )}
              {item.kind === "outreach" && (
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    Opened:{" "}
                    {item.opened ? (
                      <span className="text-emerald-600">{fmt(item.opened)}</span>
                    ) : (
                      "–"
                    )}
                  </div>
                  <div>
                    Clicked:{" "}
                    {item.clicked ? (
                      <span className="text-emerald-600">{fmt(item.clicked)}</span>
                    ) : (
                      "–"
                    )}
                  </div>
                  <div>
                    Replied:{" "}
                    {item.replied ? (
                      <span className="text-emerald-600">{fmt(item.replied)}</span>
                    ) : (
                      "–"
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {feed.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nothing recorded for this conversation yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
