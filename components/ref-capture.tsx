"use client";

import { useEffect } from "react";

const COOKIE = "sitebeat_ref";
const COOKIE_DAYS = 60;

/**
 * On mount, captures `?ref=` (Sitebeat-native) or `?via=` (Rewardful
 * convention) from the URL and persists it in a 60-day first-party
 * cookie. The SubscribeButton reads this cookie and passes `ref` in
 * the Checkout body so it lands in Stripe Checkout metadata +
 * client_reference_id.
 *
 * Mounted in the root layout — fires on every landing page once.
 */
export function RefCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const ref = sp.get("ref") || sp.get("via");
    if (!ref) return;
    if (!/^[\w.-]{1,64}$/.test(ref)) return;
    const expires = new Date(Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000);
    document.cookie = `${COOKIE}=${encodeURIComponent(ref)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }, []);
  return null;
}

export function readRefCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
