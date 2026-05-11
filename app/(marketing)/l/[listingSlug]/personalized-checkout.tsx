"use client";

import * as React from "react";
import { Pricing, type Tier } from "@/components/marketing/pricing";
import type { StylePreset } from "@/db";

interface Props {
  listingId: string;
  listingSlug: string;
  pricing: { standard: number; premium: number; rush: number };
  stylePresets: StylePreset[];
}

// Recognized promo codes for the visible banner. Display-only — Stripe is
// the source of truth at checkout. If the code isn't here, no banner shows
// (URL still passes through to checkout for unrecognized codes).
const PROMO_BANNER: Record<string, { pct: number; label: string; expiresAt?: string }> = {
  FOUNDING10: { pct: 10, label: "Founding member discount" },
  // LAUNCH50 expires 24h after creation (2026-05-08T16:08:36Z per Stripe)
  LAUNCH50: { pct: 50, label: "Launch promo", expiresAt: "2026-05-08T16:08:36Z" },
  LAUNCH30: { pct: 30, label: "Launch promo" },
};

function useCountdown(expiresAt: string | undefined): { hh: string; mm: string; ss: string; expired: boolean } | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);
  if (!expiresAt || now === null) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { hh: "00", mm: "00", ss: "00", expired: true };
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);
  return {
    hh: String(hh).padStart(2, "0"),
    mm: String(mm).padStart(2, "0"),
    ss: String(ss).padStart(2, "0"),
    expired: false,
  };
}

export function PersonalizedCheckout({ listingId, listingSlug, pricing, stylePresets }: Props) {
  const [style, setStyle] = React.useState(stylePresets[0]?.id ?? "modern");
  const [loadingTier, setLoadingTier] = React.useState<Tier | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [promo, setPromo] = React.useState<{ code: string; pct: number; label: string } | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("code")?.toUpperCase();
    if (code && PROMO_BANNER[code]) {
      setPromo({ code, ...PROMO_BANNER[code] });
    }
  }, []);

  const countdown = useCountdown(promo?.code ? PROMO_BANNER[promo.code]?.expiresAt : undefined);

  const discountedPricing = promo
    ? {
        standard: Math.round(pricing.standard * (1 - promo.pct / 100)),
        premium: Math.round(pricing.premium * (1 - promo.pct / 100)),
        rush: Math.round(pricing.rush * (1 - promo.pct / 100)),
      }
    : pricing;

  async function onSelect(tier: Tier) {
    setLoadingTier(tier);
    setError(null);
    if (typeof window !== "undefined" && (window as { fbq?: (...args: unknown[]) => void }).fbq) {
      (window as { fbq: (...args: unknown[]) => void }).fbq("track", "InitiateCheckout", {
        content_ids: [listingId],
        content_type: "product",
        contents: [{ id: listingId, quantity: 1 }],
        value: tier === "premium" ? pricing.premium / 100 : tier === "rush" ? pricing.rush / 100 : pricing.standard / 100,
        currency: "USD",
        tier,
      });
    }
    // Forward ?code=FOUNDING10 from the page URL into the checkout body, so
    // discount-pre-applied links from auto-reply emails trickle through Stripe.
    const promoCode =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("code") ?? undefined
        : undefined;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, tier, stylePreset: style, listingSlug, ...(promoCode ? { promoCode } : {}) }),
      });
      if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingTier(null);
    }
  }

  return (
    <div className="space-y-8">
      {promo && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <span>🎉</span>
              <span>{promo.label} — {promo.pct}% off applied at checkout</span>
            </div>
            {countdown && !countdown.expired && (
              <div className="shrink-0 rounded-md bg-emerald-700 px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-white">
                {countdown.hh}:{countdown.mm}:{countdown.ss}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-emerald-900/80">
            Code <span className="font-mono font-bold">{promo.code}</span> auto-applies when you click any tier below.
            {countdown && !countdown.expired
              ? ` Expires in ${countdown.hh}h ${countdown.mm}m.`
              : countdown?.expired
                ? " (Code window has closed.)"
                : " Time-limited."}
          </p>
        </div>
      )}
      <div>
        <div className="mb-3 text-sm font-medium">Pick a style preset</div>
        <div className="flex flex-wrap gap-2">
          {stylePresets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setStyle(p.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                style === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Pricing pricing={discountedPricing} onSelect={onSelect} loadingTier={loadingTier} />
      {promo && (
        <p className="text-center text-xs text-muted-foreground">
          Strike-through prices reflect the {promo.pct}% promo. You'll see the
          line-item discount at Stripe checkout before paying.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
