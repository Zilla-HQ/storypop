"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ReferForm() {
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = React.useState<"code" | "link" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/refer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json()) as { code?: string; link?: string; error?: string };
      if (!res.ok || !body.code || !body.link) {
        throw new Error(body.error ?? "Failed to generate code");
      }
      setResult({ code: body.code, link: body.link });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function copy(text: string, kind: "code" | "link") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="h-12 flex-1 text-base"
          disabled={pending}
        />
        <Button type="submit" size="lg" disabled={pending || !email}>
          {pending ? "Generating…" : "Get my code"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {result && (
        <Card className="mt-6">
          <CardContent className="space-y-4 p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your referral code
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-lg">
                {result.code}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(result.code, "code")}
              >
                {copied === "code" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shareable link
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-sm">
                {result.link}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(result.link, "link")}
              >
                {copied === "link" ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with another agent. We&apos;ll attribute every paid listing
              that comes through it to you for 30 days. Payouts are emailed monthly.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
