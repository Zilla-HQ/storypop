"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OutreachDraft } from "@/lib/outreach";

const FROM = "jack@restay.agency";

function gmailComposeUrl(draft: OutreachDraft): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: draft.to ?? "",
    su: draft.subject,
    body: draft.body,
  });
  // Pre-fill from address (only honored when Gmail is signed in to that account).
  if (FROM) params.set("from", FROM);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function mailtoUrl(draft: OutreachDraft): string {
  const params = new URLSearchParams({
    subject: draft.subject,
    body: draft.body,
  });
  return `mailto:${draft.to ?? ""}?${params.toString()}`;
}

export function OutreachCard({ draft }: { draft: OutreachDraft }) {
  const [sent, setSent] = React.useState<boolean>(false);
  const [copied, setCopied] = React.useState<"subject" | "body" | null>(null);
  const storageKey = `outreach-sent-${draft.id}`;

  React.useEffect(() => {
    const v = window.localStorage.getItem(storageKey);
    if (v === "1") setSent(true);
  }, [storageKey]);

  function toggleSent() {
    const next = !sent;
    setSent(next);
    if (next) window.localStorage.setItem(storageKey, "1");
    else window.localStorage.removeItem(storageKey);
  }

  async function copy(value: string, kind: "subject" | "body") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card className={sent ? "border-emerald-500/40 bg-emerald-500/5" : undefined}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{draft.name}</div>
            <div className="text-xs text-muted-foreground">{draft.context}</div>
            {draft.to ? (
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                → {draft.to}
              </div>
            ) : (
              <div className="mt-1 text-xs italic text-amber-700">
                {draft.contactNote ?? "Contact via DM / form (no public email)"}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSent}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
              sent
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {sent ? "✓ sent" : "mark sent"}
          </button>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Subject
            </div>
            <button
              type="button"
              onClick={() => copy(draft.subject, "subject")}
              className="text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              {copied === "subject" ? "copied" : "copy"}
            </button>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{draft.subject}</div>
        </div>

        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Body</span>
            <span className="text-primary group-open:hidden">show</span>
            <span className="hidden text-primary group-open:inline">hide</span>
          </summary>
          <div className="relative mt-2">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-3 py-3 text-xs leading-relaxed">
              {draft.body}
            </pre>
            <button
              type="button"
              onClick={() => copy(draft.body, "body")}
              className="absolute right-2 top-2 rounded border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary hover:bg-accent"
            >
              {copied === "body" ? "copied" : "copy body"}
            </button>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          {draft.to && (
            <a href={gmailComposeUrl(draft)} target="_blank" rel="noopener noreferrer">
              <Button size="sm">Open in Gmail</Button>
            </a>
          )}
          {draft.to && (
            <a href={mailtoUrl(draft)}>
              <Button size="sm" variant="outline">
                Open in mail app
              </Button>
            </a>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Personalize the opener (1 line about their latest content) before sending.
          The Gmail compose URL signs you into the right account if you're already
          on it; switch accounts in Gmail's profile menu if not.
        </p>
      </CardContent>
    </Card>
  );
}
