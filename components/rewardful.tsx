"use client";

import Script from "next/script";

/**
 * Rewardful affiliate-tracking JS. Captures `?via=` query params on
 * landing, sets a 60-day first-party cookie, exposes
 * `window.Rewardful.referral` for our SubscribeButton + EmbedAuditForm
 * to forward to Stripe Checkout as `client_reference_id`.
 *
 * Loads only when NEXT_PUBLIC_REWARDFUL_API_KEY is configured.
 *
 * Strategy choice: both scripts are `afterInteractive`. Rewardful's
 * tracker is fine to load after hydration — the tiny queue-init shim
 * runs synchronously before the tracker thanks to React render order,
 * and both queue-up calls and direct `window.Rewardful.referral` reads
 * are defensive about absence in the consuming components.
 */
export function RewardfulTracking({ apiKey }: { apiKey: string }) {
  return (
    <>
      <Script
        id="rewardful-queue"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html:
            "(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');",
        }}
      />
      <Script
        id="rewardful-tracker"
        strategy="afterInteractive"
        src="https://r.wdfl.co/rw.js"
        data-rewardful={apiKey}
      />
    </>
  );
}

/**
 * Read Rewardful's tracking referral ID from window if it's loaded.
 * The Rewardful global is set by their script after a few hundred
 * milliseconds; callers should be defensive about absence.
 */
export function readRewardfulReferral(): string | null {
  if (typeof window === "undefined") return null;
  const r = (window as unknown as { Rewardful?: { referral?: string } })
    .Rewardful;
  return r?.referral ?? null;
}
