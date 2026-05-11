import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { listConversations } from "@/lib/conversations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConversationsIndexPage() {
  const conversations = await listConversations(150).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Threaded view of every inbound + outbound email, grouped by
          lead. Includes audit reports we sent, regression alerts,
          partner outreach, and replies. Outbound logging started{" "}
          {new Date().toLocaleDateString()} — older outbound is in
          Resend&rsquo;s dashboard, not shown here.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              No conversations yet.
            </div>
          ) : (
            <ul className="divide-y">
              {conversations.map((c) => (
                <li key={c.email}>
                  <Link
                    href={`/admin/conversations/${encodeURIComponent(c.email)}`}
                    className="block p-4 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            title={
                              c.lastDirection === "inbound"
                                ? "last message: inbound"
                                : "last message: outbound"
                            }
                            className={`text-xs font-bold ${
                              c.lastDirection === "inbound"
                                ? "text-emerald-600"
                                : "text-blue-600"
                            }`}
                          >
                            {c.lastDirection === "inbound" ? "↩" : "→"}
                          </span>
                          <span className="font-medium">{c.email}</span>
                          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                            {timeAgo(c.lastMessageAt)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {c.lastSubject ?? "(no subject)"}
                        </div>
                        {c.lastSnippet ? (
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {c.lastSnippet}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.inboundCount} inbound · {c.outboundCount} outbound
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function timeAgo(date: Date): string {
  const ms = Date.now() - +date;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
