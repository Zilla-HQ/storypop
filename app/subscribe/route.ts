import { NextRequest, NextResponse } from "next/server";
import { db, sites } from "@/db";
import { eq } from "drizzle-orm";
import { stripe, publicAppUrl } from "@/lib/stripe";
import { getService } from "@/lib/services";

export const runtime = "nodejs";

/**
 * One-click subscribe redirect, used in audit-report email CTA buttons so
 * customers don't have to land on /pricing first.
 *
 * GET /subscribe?siteId=<uuid>&plan=monthly|annual&promo=<code>
 *   → creates a Stripe subscription Checkout session
 *   → if `promo` matches an active Stripe promotion_code, pre-applies it
 *     so the customer sees the discounted total without typing anything
 *   → 302 redirects to the Stripe-hosted Checkout URL
 *
 * On any failure, redirects to /pricing?siteId=<...> as the safe fallback.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  const planParam = url.searchParams.get("plan") ?? "monthly";
  const promoParam = url.searchParams.get("promo")?.trim().toUpperCase() || null;
  const planId = planParam === "annual" ? "seo-monitor-annual" : "seo-monitor-monthly";

  const fallback = (extra = "") =>
    NextResponse.redirect(new URL(`/pricing${siteId ? `?siteId=${siteId}` : ""}${extra}`, req.url));

  if (!siteId) return fallback();

  let site;
  try {
    [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  } catch {
    return fallback();
  }
  if (!site) return fallback();

  const service = getService(planId);
  if (!service?.stripePriceId) return fallback();

  // If `promo` is supplied, look up the matching active promotion_code so
  // we can pre-apply it via `discounts`. Stripe rejects sessions that pass
  // both `discounts` and `allow_promotion_codes`, so we use one or the
  // other. If the promo doesn't resolve we still let customers type a
  // code manually.
  let discounts: { promotion_code: string }[] | undefined;
  if (promoParam) {
    try {
      const matches = await stripe.promotionCodes.list({
        code: promoParam,
        active: true,
        limit: 1,
      });
      if (matches.data[0]) {
        discounts = [{ promotion_code: matches.data[0].id }];
      }
    } catch {
      // Fall through — the customer can still type the code at Checkout.
    }
  }

  const appUrl = publicAppUrl();
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: site.customerEmail ?? undefined,
      line_items: [{ price: service.stripePriceId, quantity: 1 }],
      metadata: { siteId, plan: planId, ...(promoParam ? { promo: promoParam } : {}) },
      subscription_data: { metadata: { siteId, plan: planId } },
      success_url: `${appUrl}/audit/${siteId}?subscribed=1`,
      cancel_url: `${appUrl}/pricing?siteId=${siteId}`,
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    });
  } catch {
    return fallback();
  }

  if (!session.url) return fallback();
  return NextResponse.redirect(session.url, { status: 302 });
}
