"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PartnerApplication() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      audience: String(fd.get("audience") ?? ""),
      audienceSize: String(fd.get("audienceSize") ?? ""),
      pitch: String(fd.get("pitch") ?? ""),
    };
    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to submit");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <div className="text-lg font-semibold text-emerald-700">Application received.</div>
        <p className="mt-2 text-sm text-muted-foreground">
          We review every partner application personally — usually within 48 hours.
          You'll get a unique referral link and your dashboard once approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 text-left">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your name
        </label>
        <Input name="name" required maxLength={100} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <Input type="email" name="email" required maxLength={200} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Where you reach hosts
        </label>
        <Input
          name="audience"
          required
          maxLength={200}
          placeholder="YouTube channel · Podcast · Newsletter · Coaching community"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Approx. audience size
        </label>
        <Input
          name="audienceSize"
          maxLength={50}
          placeholder="e.g. 12k YouTube subs · 800 newsletter · 50 coaching members"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          How would you promote Restay? (one paragraph)
        </label>
        <textarea
          name="pitch"
          required
          rows={4}
          maxLength={1000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="A dedicated review video · A newsletter mention · A bonus for course members · etc."
        />
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Submitting…" : "Apply to the partner program"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We approve within 48 hours. You get a unique link, real-time order
        notifications, and Stripe-paid commissions every Friday.
      </p>
    </form>
  );
}
