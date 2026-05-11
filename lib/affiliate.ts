import { cookies } from "next/headers";
import { db, referrals } from "@/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Affiliate / referral program.
 *
 * Pattern (lifted from SiteGrid):
 *   1. Partner gets a code, e.g. "JOE", and a personalized link
 *      https://merchant.example/ref/JOE
 *   2. Visiting that URL drops a 90-day cookie + writes a row with
 *      status='clicked' to referrals.
 *   3. Cookie flows through checkout into Stripe Checkout metadata as
 *      `ref_code`. The Stripe webhook reads it back and writes a
 *      status='purchased' row with amountCents.
 *   4. Monthly payout: sum status='purchased' rows per code, multiply by
 *      tier commission cents. Affiliate payouts are paid out via Wise /
 *      Venmo / Stripe Connect at month-end.
 *
 * Tier ladder (override per merchant via env or by editing this file):
 *   Sales 1–4:   $50 per sale  (Standard)
 *   Sales 5–9:   $100 per sale (Silver)
 *   Sales 10+:   $250 per sale (Gold)
 *
 * The first-N-affiliates cash bonus is paid manually — keep that out of
 * the automated payout pipeline so the operator owns the gate.
 */

export const COOKIE_NAME = "ref_code";
export const COOKIE_MAX_AGE_DAYS = 90;

export interface AffiliateTier {
  id: "standard" | "silver" | "gold";
  label: string;
  minSales: number;
  payoutCents: number;
}

export const AFFILIATE_TIERS: AffiliateTier[] = [
  { id: "standard", label: "Standard", minSales: 0, payoutCents: 5000 },
  { id: "silver", label: "Silver", minSales: 5, payoutCents: 10000 },
  { id: "gold", label: "Gold", minSales: 10, payoutCents: 25000 },
];

export function tierForSaleCount(salesCount: number): AffiliateTier {
  let current = AFFILIATE_TIERS[0];
  for (const t of AFFILIATE_TIERS) {
    if (salesCount >= t.minSales) current = t;
  }
  return current;
}

/**
 * Capture an affiliate code from the URL ?ref=... param into the cookie.
 * Call from page-render functions or a route handler — Next.js cookies()
 * is a server-side API. Cookies survive 90 days by default.
 */
export async function captureRefCookie(code: string | null | undefined): Promise<void> {
  if (!code) return;
  const clean = code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  if (!clean) return;
  const jar = await cookies();
  jar.set(COOKIE_NAME, clean, {
    maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    path: "/",
    httpOnly: false, // readable client-side for client-side checkouts
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readRefCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Record an affiliate click. Idempotent-ish: a single IP+code can
 * generate multiple click rows over time (treated as separate
 * impressions). The downstream aggregator deduplicates if needed.
 */
export async function recordClick(args: {
  code: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.insert(referrals).values({
    code: args.code,
    status: "clicked",
    ip: args.ip ?? null,
    userAgent: args.userAgent ?? null,
  });
}

/**
 * Record a purchase against an affiliate code. Called from the Stripe
 * webhook handler when checkout.session.completed includes a
 * `ref_code` metadata field.
 */
export async function recordPurchase(args: {
  code: string;
  orderId?: string;
  amountCents: number;
}): Promise<void> {
  await db.insert(referrals).values({
    code: args.code,
    status: "purchased",
    orderId: args.orderId,
    amountCents: args.amountCents,
  });
}

export interface AffiliateLeaderRow {
  code: string;
  clicks: number;
  purchases: number;
  revenueCents: number;
  tier: AffiliateTier;
  payoutOwedCents: number;
}

/**
 * Read the affiliate leaderboard. Returns one row per code, sorted by
 * purchases desc, then clicks desc.
 */
export async function getLeaderboard(): Promise<AffiliateLeaderRow[]> {
  const rows = await db
    .select({
      code: referrals.code,
      status: referrals.status,
      amountCents: referrals.amountCents,
    })
    .from(referrals);

  const agg = new Map<
    string,
    { clicks: number; purchases: number; revenueCents: number }
  >();
  for (const r of rows) {
    const a = agg.get(r.code) ?? { clicks: 0, purchases: 0, revenueCents: 0 };
    if (r.status === "clicked") a.clicks += 1;
    if (r.status === "purchased") {
      a.purchases += 1;
      a.revenueCents += r.amountCents ?? 0;
    }
    agg.set(r.code, a);
  }

  return [...agg.entries()]
    .map(([code, a]) => {
      const tier = tierForSaleCount(a.purchases);
      return {
        code,
        clicks: a.clicks,
        purchases: a.purchases,
        revenueCents: a.revenueCents,
        tier,
        payoutOwedCents: a.purchases * tier.payoutCents,
      };
    })
    .sort((x, y) => y.purchases - x.purchases || y.clicks - x.clicks);
}

/**
 * Look up stats for a single affiliate code (for the partner-facing
 * dashboard at /partners/dashboard).
 */
export async function statsForCode(code: string): Promise<AffiliateLeaderRow | null> {
  const [row] = await db
    .select({
      clicks: sql<number>`count(*) filter (where ${referrals.status} = 'clicked')::int`,
      purchases: sql<number>`count(*) filter (where ${referrals.status} = 'purchased')::int`,
      revenueCents: sql<number>`coalesce(sum(${referrals.amountCents}) filter (where ${referrals.status} = 'purchased'), 0)::int`,
    })
    .from(referrals)
    .where(eq(referrals.code, code));
  if (!row) return null;
  const purchases = Number(row.purchases ?? 0);
  const tier = tierForSaleCount(purchases);
  return {
    code,
    clicks: Number(row.clicks ?? 0),
    purchases,
    revenueCents: Number(row.revenueCents ?? 0),
    tier,
    payoutOwedCents: purchases * tier.payoutCents,
  };
}
