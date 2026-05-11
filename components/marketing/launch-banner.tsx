"use client";

import * as React from "react";

const LAUNCH50_EXPIRES_AT = "2026-05-08T16:08:36Z";

function useCountdown(expiresAt: string): { hh: string; mm: string; ss: string; expired: boolean } | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  if (now === null) return null;
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

/**
 * Sticky launch-promo banner shown above the marketing page header.
 * Visible to every visitor of /agents, /renovate, /pool-cost/*, etc.
 * Hidden once the LAUNCH50 window closes.
 */
export function LaunchBanner() {
  const countdown = useCountdown(LAUNCH50_EXPIRES_AT);
  const [copied, setCopied] = React.useState(false);

  if (!countdown || countdown.expired) return null;

  async function copyCode() {
    await navigator.clipboard.writeText("LAUNCH50");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-b border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-emerald-500/15">
      <div className="container flex flex-col items-center justify-center gap-2 py-2 text-xs sm:flex-row sm:gap-4 sm:text-sm">
        <span className="font-semibold text-emerald-900">
          🎉 50% off launch promo
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-md bg-emerald-700 px-2 py-0.5 font-mono font-bold text-white transition-colors hover:bg-emerald-800"
          aria-label="Copy LAUNCH50 promo code"
        >
          {copied ? "COPIED ✓" : "LAUNCH50"}
        </button>
        <span className="text-emerald-900/80">
          auto-applies at checkout · ends in
        </span>
        <span className="rounded-md bg-emerald-900 px-2 py-0.5 font-mono font-bold tabular-nums text-white">
          {countdown.hh}:{countdown.mm}:{countdown.ss}
        </span>
      </div>
    </div>
  );
}
