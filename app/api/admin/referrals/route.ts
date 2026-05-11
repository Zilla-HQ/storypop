import { NextResponse } from "next/server";
import { getLeaderboard, AFFILIATE_TIERS } from "@/lib/affiliate";

/**
 * Admin endpoint: affiliate leaderboard.
 *
 * GET /api/admin/referrals → { tiers, rows: [{ code, clicks, purchases,
 *   revenueCents, tier, payoutOwedCents }] }
 *
 * Gating: ensure the merchant's admin middleware (Clerk + ADMIN_EMAIL +
 * ADMIN_DOMAINS) covers /api/admin/*. The existing middleware.ts in
 * merchant-template enforces that for any /admin/* route; mirror that
 * pattern for /api/admin/*.
 */
export async function GET() {
  const rows = await getLeaderboard();
  return NextResponse.json({
    tiers: AFFILIATE_TIERS,
    rows: rows.map((r) => ({
      code: r.code,
      clicks: r.clicks,
      purchases: r.purchases,
      revenueCents: r.revenueCents,
      tier: r.tier,
      payoutOwedCents: r.payoutOwedCents,
    })),
  });
}
