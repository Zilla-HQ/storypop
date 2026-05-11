"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (
      cmd: "track" | "trackCustom",
      event: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

interface Props {
  orderId: string;
  amountCents: number;
  listingId: string;
  status: string;
  tier: string;
}

export function TrackPurchase({ orderId, amountCents, listingId, status, tier }: Props) {
  useEffect(() => {
    if (status !== "paid" && status !== "fulfilled") return;
    if (typeof window === "undefined" || !window.fbq) return;
    const key = `fbq_purchase_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.fbq(
      "track",
      "Purchase",
      {
        value: amountCents / 100,
        currency: "USD",
        content_ids: [listingId],
        content_type: "product",
        order_id: orderId,
        tier,
      },
      { eventID: `order_${orderId}` },
    );
  }, [orderId, amountCents, listingId, status, tier]);

  return null;
}
