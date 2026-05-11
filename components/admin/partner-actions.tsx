"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Mode = "initial" | "followup" | "custom" | null;

export function PartnerActions({
  prospectId,
  hasBeenSent,
  isUnsubscribed,
}: {
  prospectId: string;
  hasBeenSent: boolean;
  isUnsubscribed: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (isUnsubscribed) {
    return (
      <p className="rounded-md border bg-red-50 p-4 text-sm text-red-900">
        This prospect has unsubscribed. Sends are blocked at the
        compliance layer.
      </p>
    );
  }

  async function send(variant: "initial" | "followup" | "custom") {
    setError(null);
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/partner-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          prospectId,
          variant,
          customSubject: variant === "custom" ? subject : undefined,
          customText: variant === "custom" ? body : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Send failed");
        setSubmitting(false);
        return;
      }
      setFeedback(`Sent. Message ID: ${json.messageId ?? "(no id)"}`);
      setSubject("");
      setBody("");
      setMode(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === "initial" ? "default" : "outline"}
          size="sm"
          disabled={submitting || hasBeenSent}
          onClick={() => setMode(mode === "initial" ? null : "initial")}
        >
          {hasBeenSent ? "Initial pitch sent" : "Send initial pitch"}
        </Button>
        <Button
          type="button"
          variant={mode === "followup" ? "default" : "outline"}
          size="sm"
          disabled={submitting || !hasBeenSent}
          onClick={() => setMode(mode === "followup" ? null : "followup")}
        >
          Send canned follow-up
        </Button>
        <Button
          type="button"
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          disabled={submitting}
          onClick={() => setMode(mode === "custom" ? null : "custom")}
        >
          Write custom message
        </Button>
      </div>

      {mode === "initial" && (
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-sm">
            Sends the canned initial pitch (~150 words) to this prospect
            from <code>partners@</code>. CC&rsquo;d to ops via the inbound
            forward.
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={submitting}
            onClick={() => send("initial")}
          >
            {submitting ? "Sending…" : "Confirm send"}
          </Button>
        </div>
      )}

      {mode === "followup" && (
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-sm">
            Sends the canned 5-day follow-up. Threaded via In-Reply-To
            so it lands in the same email thread as the initial pitch.
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={submitting}
            onClick={() => send("followup")}
          >
            {submitting ? "Sending…" : "Confirm send"}
          </Button>
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-4">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border bg-background p-2 text-sm"
          />
          <textarea
            placeholder="Body. Plain text — paragraphs separated by blank lines. List-Unsubscribe + footer auto-added."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
            rows={10}
            className="w-full rounded-md border bg-background p-3 text-sm font-mono"
          />
          <Button
            type="button"
            disabled={submitting || !subject.trim() || !body.trim()}
            onClick={() => send("custom")}
          >
            {submitting ? "Sending…" : "Send custom"}
          </Button>
        </div>
      )}

      {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
