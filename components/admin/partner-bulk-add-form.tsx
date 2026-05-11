"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Bulk-add UI for /admin/partner-outreach.
 *
 * Operator pastes a list of emails (or CSV `email,name,company,notes`)
 * and chooses whether to send the initial pitch immediately. The
 * server-side endpoint dedupes against existing rows and the
 * blacklist, so re-pasting a known list is safe.
 */
export function PartnerBulkAddForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parseRows(input: string) {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        // CSV-light: email,name,company,notes
        const [email = "", name = "", company = "", notes = ""] = line
          .split(",")
          .map((p) => p.trim());
        return { email, name: name || undefined, company: company || undefined, notes: notes || undefined };
      })
      .filter((r) => r.email.includes("@"));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const rows = parseRows(text);
    if (rows.length === 0) {
      setError("No valid emails found.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/partner-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: sendNow ? "send_initial" : "bulk_add",
          rows,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        setSubmitting(false);
        return;
      }
      setFeedback(
        sendNow
          ? `Added ${json.inserted} new prospects, sent ${json.sent} initial pitches${json.failed ? ` (${json.failed} failed)` : ""}.`
          : `Added ${json.inserted} new prospects (${json.attempted - json.inserted} duplicates / blacklisted skipped).`,
      );
      setText("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`hello@example.com\nemail@otheragency.com,Jane Doe,Other Agency,WP plugin focus`}
        rows={6}
        disabled={submitting}
        className="w-full rounded-md border bg-background p-3 font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sendNow}
            onChange={(e) => setSendNow(e.target.checked)}
            disabled={submitting}
          />
          Send initial pitch immediately
        </label>
        <Button type="submit" disabled={submitting || !text.trim()}>
          {submitting ? "Working…" : sendNow ? "Add + send" : "Add to queue"}
        </Button>
      </div>
      {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
