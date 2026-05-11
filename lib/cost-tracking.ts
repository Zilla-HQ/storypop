import { env } from "@/lib/env";
import { db, subscriptions } from "@/db";
import { eq, sql } from "drizzle-orm";

/**
 * Cost + revenue rollup for the admin spend card. Pulls live data from
 * Apify (compute usage) + Stripe (gross subscription revenue) + the local
 * subscriptions table (active count). All fail-soft — admin still
 * renders if any source is unreachable.
 */

export interface SpendReport {
  apifyCreditsUsed: number; // dollars
  apifyCreditLimit: number;
  apifyMonthlyUsage: number;
  stripeRevenueLifetimeUsd: number;
  stripeRevenueMtdUsd: number;
  stripeActiveSubscriptions: number;
  stripeMrrUsd: number;
  resendStatus: string;
  fetchedAt: string;
  errors: string[];
}

const ZERO: SpendReport = {
  apifyCreditsUsed: 0,
  apifyCreditLimit: 5,
  apifyMonthlyUsage: 0,
  stripeRevenueLifetimeUsd: 0,
  stripeRevenueMtdUsd: 0,
  stripeActiveSubscriptions: 0,
  stripeMrrUsd: 0,
  resendStatus: "unknown",
  fetchedAt: new Date().toISOString(),
  errors: [],
};

interface ApifyUserResponse {
  data?: {
    plan?: { id?: string; description?: string };
    monthlyUsage?: { compute?: number };
    currentBillingPeriod?: { startAt?: string; endAt?: string };
  };
}

async function apifyUsage(): Promise<{ used: number; error?: string }> {
  const token = env("APIFY_TOKEN");
  if (!token) return { used: 0, error: "APIFY_TOKEN not set" };
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { used: 0, error: `Apify ${res.status}` };
    const json = (await res.json()) as ApifyUserResponse;
    // Apify reports compute usage in CU (compute units). 1 CU ≈ $0.25 on
    // the free plan. This is an approximation; actual billing varies by
    // Actor cost.
    const compute = json.data?.monthlyUsage?.compute ?? 0;
    return { used: Number((compute * 0.25).toFixed(2)) };
  } catch (err) {
    return { used: 0, error: (err as Error).message };
  }
}

async function stripeRevenue(): Promise<{
  lifetimeUsd: number;
  mtdUsd: number;
  activeSubs: number;
  mrr: number;
  error?: string;
}> {
  // Pull from local subscriptions table — this is mirrored from Stripe
  // webhook events so it's authoritative for our system. For raw Stripe
  // call, would need a separate Stripe Reporting API key (skip for v1).
  try {
    const [active] = await db
      .select({
        n: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    // Each active sub adds $29 (monthly) or $290/12 = $24.17 (annual) to
    // MRR. Without per-sub plan tracking yet, approximate as $29.
    const subCount = active?.n ?? 0;
    const mrr = subCount * 29;

    return {
      lifetimeUsd: subCount * 29, // crude, only counts current actives × monthly price
      mtdUsd: subCount * 29,
      activeSubs: subCount,
      mrr,
    };
  } catch (err) {
    return { lifetimeUsd: 0, mtdUsd: 0, activeSubs: 0, mrr: 0, error: (err as Error).message };
  }
}

export async function getSpendReport(): Promise<SpendReport> {
  const errors: string[] = [];
  const [apify, stripe] = await Promise.all([apifyUsage(), stripeRevenue()]);
  if (apify.error) errors.push(`Apify: ${apify.error}`);
  if (stripe.error) errors.push(`Stripe: ${stripe.error}`);

  return {
    ...ZERO,
    apifyCreditsUsed: apify.used,
    stripeRevenueLifetimeUsd: stripe.lifetimeUsd,
    stripeRevenueMtdUsd: stripe.mtdUsd,
    stripeActiveSubscriptions: stripe.activeSubs,
    stripeMrrUsd: stripe.mrr,
    resendStatus: env("RESEND_API_KEY") ? "free tier (3K/mo)" : "not configured",
    fetchedAt: new Date().toISOString(),
    errors,
  };
}
