"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/services";

interface Props {
  className?: string;
  /** When set, lock the form to a specific service (e.g. on a service detail page). */
  fixedServiceId?: string;
  /** Custom CTA label (defaults to the picked service's CTA). */
  ctaLabel?: string;
  /** When set, render a "try a sample" link below the form that pre-fills with this URL. */
  sampleUrl?: string;
}

const DEFAULT_SAMPLE = "https://www.zillow.com/homedetails/112-S-Rumson-Ave-Margate-NJ-08402/37822159_zpid/";

export function SelfServeForm({ className, fixedServiceId, ctaLabel, sampleUrl }: Props) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [serviceId, setServiceId] = React.useState(fixedServiceId ?? SERVICES[0].id);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sample = sampleUrl ?? DEFAULT_SAMPLE;

  const activeService = SERVICES.find((s) => s.id === serviceId) ?? SERVICES[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    // Shared id between the browser pixel and the server CAPI call so Meta
    // dedupes the two as one Lead event.
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const res = await fetch("/api/self-serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), serviceId, eventId }),
      });
      const body = (await res.json()) as {
        listingId?: string;
        slug?: string;
        existed?: boolean;
        error?: string;
      };
      if (!res.ok || !body.listingId) {
        throw new Error(body.error ?? "Something went wrong");
      }
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === "function") {
        fbq("track", "Lead", { content_name: "self_serve_submitted" }, { eventID: eventId });
      }
      if (body.existed && body.slug) {
        router.push(`/l/${body.slug}?service=${serviceId}`);
      } else {
        router.push(`/generating/${body.listingId}?service=${serviceId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`mx-auto flex w-full max-w-2xl flex-col gap-3 ${className ?? ""}`}
    >
      {!fixedServiceId && (
        <div className="flex flex-wrap justify-center gap-2">
          {SERVICES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                serviceId === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              {s.name}
              {s.basePriceCents === 0 && (
                <span className="ml-1 text-[9px] uppercase tracking-wider opacity-80">
                  free
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Zillow, Redfin, or Realtor.com listing URL"
          className="h-12 flex-1 text-base"
          disabled={pending}
        />
        <Button type="submit" size="lg" disabled={pending || !url}>
          {pending ? "Starting…" : ctaLabel ?? activeService.ctaPrimary}
        </Button>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => setUrl(sample)}
        className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Don't have a URL handy? Try our sample listing →
      </button>
      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
