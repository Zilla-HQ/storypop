import { db, inboundEmails } from "@/db";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ACTION_COLOR: Record<string, string> = {
  auto_unsubscribed: "bg-amber-500/10 text-amber-700",
  forwarded: "bg-blue-500/10 text-blue-700",
  stored: "bg-muted text-muted-foreground",
};

export default async function AdminRepliesPage() {
  const rows = await db
    .select({
      id: inboundEmails.id,
      fromAddress: inboundEmails.fromAddress,
      toAddress: inboundEmails.toAddress,
      subject: inboundEmails.subject,
      text: inboundEmails.text,
      action: inboundEmails.action,
      createdAt: inboundEmails.createdAt,
    })
    .from(inboundEmails)
    .orderBy(desc(inboundEmails.createdAt))
    .limit(50)
    .catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Replies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inbound emails to <code>replies@</code> (last 50). STOP / unsubscribe replies are
          auto-actioned and the address is added to the blacklist.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              No replies yet. Configure Resend Inbound (or your forwarder) to POST to{" "}
              <code>/api/resend/webhook</code>.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.fromAddress}</span>
                        <span className="text-xs text-muted-foreground">→ {r.toAddress}</span>
                        <span
                          className={`ml-auto rounded px-2 py-0.5 text-xs font-medium ${
                            ACTION_COLOR[r.action] ?? "bg-muted"
                          }`}
                        >
                          {r.action.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-medium">{r.subject || "(no subject)"}</div>
                      {r.text ? (
                        <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                          {r.text}
                        </div>
                      ) : null}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}Z
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
