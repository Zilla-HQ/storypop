"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Audit form for the embeddable iframe widget. Opens results in a new
 * tab (rather than redirecting the iframe) so the user stays on the
 * embedding partner's site.
 */
export function EmbedAuditForm() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          email: email || undefined,
          attribution: {
            utmSource: "embed_widget",
            utmMedium: "referral",
            referrer: typeof document !== "undefined" ? document.referrer : undefined,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        auditId?: string;
        error?: string;
      };
      if (!res.ok || !json.auditId) {
        setError(json.error ?? "Could not start audit");
        setSubmitting(false);
        return;
      }
      // Open the results in a new top-level tab so the user leaves
      // the iframe context (otherwise a 1000×400px iframe tries to
      // render the full report).
      //
      // Forward `?via=` and `?ref=` from the iframe's URL to the new
      // tab. The iframe sits in a third-party-cookie context on the
      // partner's site, so cookies set inside the iframe may not
      // persist; passing via= in the URL lets Rewardful's JS on the
      // new (first-party) tab set the cookie reliably.
      const sp = new URLSearchParams(window.location.search);
      const passthrough = new URLSearchParams();
      const via = sp.get("via");
      const ref = sp.get("ref");
      if (via) passthrough.set("via", via);
      if (ref) passthrough.set("ref", ref);
      const qs = passthrough.toString();
      const target = `${window.location.origin}/audit/${json.auditId}${qs ? `?${qs}` : ""}`;
      window.open(target, "_blank", "noopener,noreferrer");
      setUrl("");
      setEmail("");
      setSubmitting(false);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        type="text"
        inputMode="url"
        autoComplete="url"
        placeholder="yourdomain.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        disabled={submitting}
        className="h-12 text-base"
      />
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@company.com (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        className="h-12 text-base"
      />
      <Button type="submit" disabled={submitting || !url} size="lg" className="h-12">
        {submitting ? "Starting…" : "Get free SEO audit"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
