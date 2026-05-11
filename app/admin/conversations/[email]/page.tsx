import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ConversationReplyForm } from "@/components/admin/conversation-reply-form";
import { getThread } from "@/lib/conversations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIRECTION_TONE: Record<"inbound" | "outbound", string> = {
  inbound: "border-l-emerald-500 bg-emerald-50/40",
  outbound: "border-l-blue-500 bg-blue-50/40",
};

const DIRECTION_LABEL: Record<"inbound" | "outbound", string> = {
  inbound: "↩ inbound",
  outbound: "→ outbound",
};

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);
  if (!email.includes("@")) notFound();

  const thread = await getThread(email);

  // Pick the most recent inbound for the reply form (so In-Reply-To
  // threading lands in the right thread on the prospect's side).
  const lastInbound = [...thread]
    .reverse()
    .find((m) => m.direction === "inbound");
  // Last subject seen, for default subject in reply form.
  const lastSubject = thread.length > 0 ? thread[thread.length - 1].subject : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/conversations"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All conversations
        </Link>
        <h1 className="mt-2 break-all text-2xl font-bold">{email}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {thread.length} {thread.length === 1 ? "message" : "messages"} —
          chronological, oldest first.
        </p>
      </div>

      {thread.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            No messages found for this address.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {thread.map((m) => {
            const direction = m.direction === "outbound" ? "outbound" : "inbound";
            return (
              <Card
                key={m.id}
                className={`border-l-4 ${DIRECTION_TONE[direction]}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className={
                          direction === "inbound"
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-blue-700"
                        }
                      >
                        {DIRECTION_LABEL[direction]}
                      </span>
                      <span>·</span>
                      <span>{m.fromAddress}</span>
                      <span>→</span>
                      <span>{m.toAddress}</span>
                      {m.tag ? (
                        <>
                          <span>·</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                            {m.tag}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <time className="whitespace-nowrap text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <div className="mt-2 font-medium">
                    {m.subject ?? "(no subject)"}
                  </div>
                  {m.text ? (
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {m.text}
                    </pre>
                  ) : (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      (no body captured by webhook — see Resend dashboard for full content)
                    </p>
                  )}
                  {m.action !== "stored" && m.action !== "sent" ? (
                    <div className="mt-2 text-xs">
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                        {m.action.replace(/_/g, " ")}
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Send reply</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sends from <code>alerts@mail.sitebeat.tech</code> with proper
            CAN-SPAM footer + List-Unsubscribe headers. Threaded via
            In-Reply-To against{" "}
            {lastInbound
              ? `the most recent inbound (${new Date(lastInbound.createdAt).toLocaleDateString()})`
              : "no prior inbound — sends as a fresh message"}
            . The outbound logs back into this thread automatically.
          </p>
          <div className="mt-4">
            <ConversationReplyForm
              toEmail={email}
              defaultSubject={
                lastSubject?.startsWith("Re:") ? lastSubject : `Re: ${lastSubject ?? ""}`
              }
              inReplyToMessageId={lastInbound?.messageId ?? null}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
