"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackPixel } from "@/components/meta-pixel";

export function AuditForm({ initialUrl = "" }: { initialUrl?: string } = {}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from `?url=` query param when no explicit `initialUrl` was
  // passed. Lets `/?url=domain` links from public audit pages and
  // outreach emails land users with the form already filled in.
  useEffect(() => {
    if (initialUrl) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const fromQuery = sp.get("url");
    if (fromQuery && !url) setUrl(fromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // Shared event_id for browser↔server dedupe via CAPI.
    const metaEventId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    // Attribution capture: pull UTM tags + fbclid from the landing URL,
    // and the document referrer. The server pulls _fbp/_fbc cookies and
    // IP/UA itself in app/api/audit/route.ts.
    const attribution =
      typeof window !== "undefined"
        ? (() => {
            const sp = new URLSearchParams(window.location.search);
            const get = (k: string) => sp.get(k) || undefined;
            return {
              fbclid: get("fbclid"),
              utmSource: get("utm_source"),
              utmMedium: get("utm_medium"),
              utmCampaign: get("utm_campaign"),
              utmTerm: get("utm_term"),
              utmContent: get("utm_content"),
              referrer: document.referrer || undefined,
            };
          })()
        : {};
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email: email || undefined, metaEventId, attribution }),
      });
      const json = (await res.json().catch(() => ({}))) as { auditId?: string; error?: string };
      if (!res.ok || !json.auditId) {
        setError(json.error ?? "Could not start audit");
        setSubmitting(false);
        return;
      }
      // Fire Meta Pixel `Lead` event — primary optimization signal.
      // eventID matches the server-side CAPI fire so Meta dedupes.
      trackPixel("Lead", {
        content_name: "audit_submit",
        content_category: "seo_audit",
        eventID: metaEventId,
      });
      router.push(`/audit/${json.auditId}`);
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
        placeholder="you@company.com (optional — to receive the full report)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        className="h-12 text-base"
      />
      <Button type="submit" disabled={submitting || !url} size="lg" className="h-12">
        {submitting ? "Starting…" : "Get my audit"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
