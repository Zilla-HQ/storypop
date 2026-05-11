"use client";

import * as React from "react";

/**
 * Slowly-incrementing live counter for "X listings enhanced this week."
 *
 * Pulls the lifetime count once on mount, then ticks up smoothly with a
 * tiny pseudo-random jitter so visitors who linger see the number rise.
 * Not a substitute for real metrics — just a confidence signal.
 */
export function LiveCounter() {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/listings-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: number } | null) => {
        if (cancelled || !d?.count) return;
        setCount(d.count);
      })
      .catch(() => {
        // Silent fail — counter just doesn't render
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (count === null) return;
    const interval = setInterval(() => {
      setCount((c) => (c == null ? c : c + (Math.random() < 0.4 ? 1 : 0)));
    }, 7000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, [count]);

  if (count === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>
        <span className="font-semibold tabular-nums text-foreground">
          {count.toLocaleString()}
        </span>{" "}
        listings enhanced
      </span>
    </span>
  );
}
