"use client";

import { useEffect } from "react";

/**
 * Captures landing-page UTM params to localStorage on first visit so any
 * later form submission can attribute correctly. Storypop-hq's middleware
 * already drops a `rs_ref` cookie for the `?ref=` param, but UTMs are a
 * separate concern (Meta / Google ads → utm_source=meta, etc.) and need
 * their own capture.
 *
 * Ported from storypop.shop so the landing surface is identical.
 */
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const STORAGE_KEY = "storypop_utm";

export function UTMCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of KEYS) {
        const v = params.get(k);
        if (v) utm[k] = v;
      }
      if (Object.keys(utm).length === 0) return;
      // First-touch wins: don't overwrite if already stored.
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...utm, landingUrl: window.location.href, t: Date.now() }),
      );
    } catch {
      // Storage disabled / private mode — silently skip.
    }
  }, []);
  return null;
}
