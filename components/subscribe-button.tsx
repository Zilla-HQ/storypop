"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readRefCookie } from "@/components/ref-capture";
import { readRewardfulReferral } from "@/components/rewardful";

export function SubscribeButton({
  siteId,
  plan,
}: {
  siteId: string | undefined;
  plan: "seo-monitor-monthly" | "seo-monitor-annual";
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    if (!siteId) {
      setError("Run a free audit first to attach your site.");
      return;
    }
    setSubmitting(true);
    try {
      // Rewardful's referral ID takes priority over our manual ref
      // cookie — Rewardful needs THEIR generated UUID in
      // client_reference_id to attribute the conversion. Our manual
      // ref cookie is the fallback for non-Rewardful affiliates.
      const referral = readRewardfulReferral() ?? undefined;
      const ref = readRefCookie() ?? undefined;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          plan,
          email: email || undefined,
          referral,
          ref,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start checkout");
        setSubmitting(false);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  if (!siteId) {
    return (
      <Link
        href="/"
        className="block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Run free audit first →
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
      />
      <Button onClick={go} disabled={submitting} size="lg" className="w-full">
        {submitting
          ? "Starting checkout…"
          : plan === "seo-monitor-monthly"
            ? "Start free 14-day trial"
            : "Subscribe"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
