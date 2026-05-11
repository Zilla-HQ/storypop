"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ConversationReplyForm({
  toEmail,
  defaultSubject,
  inReplyToMessageId,
}: {
  toEmail: string;
  defaultSubject?: string;
  inReplyToMessageId?: string | null;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/conversations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          subject,
          text: body,
          inReplyTo: inReplyToMessageId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Send failed");
        setSubmitting(false);
        return;
      }
      setFeedback(`Sent. Message ID: ${json.messageId ?? "(no id)"}`);
      setBody("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={submitting}
        required
        className="w-full rounded-md border bg-background p-2 text-sm"
      />
      <textarea
        placeholder="Reply body. Plain text — paragraphs separated by blank lines. CAN-SPAM footer + unsubscribe link auto-added."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={submitting}
        rows={14}
        required
        className="w-full rounded-md border bg-background p-3 font-mono text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting || !body.trim() || !subject.trim()}>
          {submitting ? "Sending…" : `Send to ${toEmail}`}
        </Button>
        {feedback ? <span className="text-sm text-emerald-700">{feedback}</span> : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}
