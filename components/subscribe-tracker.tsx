"use client";

import { useEffect } from "react";
import { trackPixel } from "@/components/meta-pixel";

/**
 * Fires the Meta Pixel `Purchase` event exactly once when the user lands
 * on /audit/[id]?subscribed=1 — Stripe's success_url after a completed
 * subscription Checkout.
 *
 * `metaEventId` is read from the success_url query param (`meta_eid`) and
 * matches the server-side CAPI Purchase fire from the Stripe webhook so
 * Meta dedupes browser+server attribution into one conversion.
 */
export function SubscribeTracker({
  subscribed,
  estimatedValueUsd,
  metaEventId,
}: {
  subscribed: boolean;
  estimatedValueUsd?: number;
  metaEventId?: string;
}) {
  useEffect(() => {
    if (!subscribed) return;
    if (typeof window === "undefined") return;
    const fireKey = `sb_pixel_purchase_fired:${metaEventId ?? "_"}`;
    if (sessionStorage.getItem(fireKey)) return;
    sessionStorage.setItem(fireKey, "1");
    trackPixel("Purchase", {
      currency: "USD",
      value: estimatedValueUsd ?? 29,
      content_name: "subscription",
      ...(metaEventId ? { eventID: metaEventId } : {}),
    });
  }, [subscribed, estimatedValueUsd, metaEventId]);
  return null;
}
