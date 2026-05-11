import Link from "next/link";
import { FlashDismissButton } from "./flash-dismiss-button";

/**
 * Site-wide flash-promo banner. Shipped 2026-05-07 to convert
 * traffic-on-the-bubble during launch week. FLASH50 = 50% off,
 * first 10 redemptions, 24-hour expiry. Auto-applies via the
 * /?promo=FLASH50 cookie middleware in middleware.ts.
 *
 * Server component — renders inline in the SSR'd HTML so the
 * banner shows on first paint (vs. flash-of-hidden-content with
 * a client-only mount). The dismiss button is the one client
 * island, since dismissal is per-browser cookie state.
 *
 * The `spotsLeft` prop is server-fetched from Stripe each render
 * — real scarcity, not fake. Layout passes the live count plus the
 * dismissed flag (from cookies()) so we can server-skip render
 * for visitors who already dismissed.
 */
export function FlashPromoBanner({
  spotsLeft = 10,
  dismissed = false,
}: {
  spotsLeft?: number;
  dismissed?: boolean;
}) {
  if (dismissed) return null;
  if (spotsLeft <= 0) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
      <div className="container flex items-center justify-between gap-4 py-2.5 text-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Launch
          </span>
          <span>
            <strong>50% off</strong> the Tune-Up — code{" "}
            <strong className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">
              FLASH50
            </strong>
            .{" "}
            <strong className="whitespace-nowrap">
              {spotsLeft} of 10 spots left
            </strong>
            <span className="hidden sm:inline">, expires tomorrow.</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/?promo=FLASH50#paste"
            className="hidden rounded bg-white px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 sm:inline-block"
          >
            Claim →
          </Link>
          <FlashDismissButton />
        </div>
      </div>
    </div>
  );
}
