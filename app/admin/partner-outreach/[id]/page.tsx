import Link from "next/link";
import { notFound } from "next/navigation";
import { db, partnerOutreach, inboundEmails } from "@/db";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerActions } from "@/components/admin/partner-actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  queued: "bg-slate-200 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  replied: "bg-emerald-100 text-emerald-800",
  interested: "bg-emerald-100 text-emerald-800",
  joined: "bg-emerald-200 text-emerald-900",
  passed: "bg-amber-100 text-amber-800",
  unsubscribed: "bg-red-100 text-red-800",
};

export default async function PartnerProspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prospect] = await db
    .select()
    .from(partnerOutreach)
    .where(eq(partnerOutreach.id, id))
    .limit(1);

  if (!prospect) notFound();

  // All inbound replies from this address (case-insensitive).
  const replies = await db
    .select({
      id: inboundEmails.id,
      subject: inboundEmails.subject,
      text: inboundEmails.text,
      action: inboundEmails.action,
      createdAt: inboundEmails.createdAt,
    })
    .from(inboundEmails)
    .where(eq(inboundEmails.fromAddress, prospect.email.toLowerCase()))
    .orderBy(desc(inboundEmails.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/partner-outreach"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All prospects
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold break-all">{prospect.email}</h1>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[prospect.status] ?? "bg-muted"}`}>
            {prospect.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {prospect.name ?? "—"}
          {prospect.company ? ` · ${prospect.company}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Sends" value={prospect.sendCount.toString()} />
        <Stat label="Replies" value={prospect.replyCount.toString()} />
        <Stat
          label="Last sent"
          value={prospect.lastSentAt ? new Date(prospect.lastSentAt).toLocaleDateString() : "—"}
        />
        <Stat
          label="Last replied"
          value={
            prospect.lastRepliedAt
              ? new Date(prospect.lastRepliedAt).toLocaleDateString()
              : "—"
          }
        />
      </div>

      {prospect.notes ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-wrap">{prospect.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Send</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose initial pitch (only if no pitch sent yet), follow-up
            (uses the canned 5-day template), or write a custom reply.
            All sends go from{" "}
            <code>partners@{process.env.SENDER_DOMAIN ?? "<sender>"}</code>{" "}
            and are threaded with the previous message via In-Reply-To.
          </p>
          <div className="mt-4">
            <PartnerActions
              prospectId={prospect.id}
              hasBeenSent={prospect.sendCount > 0}
              isUnsubscribed={prospect.status === "unsubscribed"}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold">Reply thread</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Inbound replies from <code>{prospect.email}</code>. Outbound sends
          are tracked above (count + last-sent timestamp).
        </p>
        {replies.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="p-8 text-sm text-muted-foreground">
              No replies yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {replies.map((r) => (
              <li key={r.id}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        {new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}Z
                      </div>
                      <span className={`rounded px-2 py-0.5 ${
                        r.action === "auto_unsubscribed"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted"
                      }`}>
                        {r.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-2 font-medium">{r.subject ?? "(no subject)"}</div>
                    {r.text ? (
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                        {r.text}
                      </pre>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
