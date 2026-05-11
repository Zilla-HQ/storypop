import { NextRequest, NextResponse } from "next/server";
import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { stripe, publicAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Self-serve subscription management. Customer hits this URL → we look up
 * their subscription by site → mint a Stripe Customer Portal session →
 * 302 to it. Stripe handles cancellation, payment-method update, invoice
 * history, etc. — no UI to build on our side.
 *
 * GET /api/billing-portal?siteId=<uuid>
 *   → 302 to portal URL on success
 *   → 302 to /pricing on missing/invalid sub (graceful)
 *   → 503 if Stripe Customer Portal isn't configured in the dashboard
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.siteId, siteId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    return NextResponse.redirect(new URL(`/pricing?siteId=${siteId}`, req.url));
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${publicAppUrl()}/audit/${siteId}`,
    });
    return NextResponse.redirect(session.url, { status: 302 });
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    return NextResponse.json(
      {
        error: "Customer Portal not available",
        detail:
          "Configure the Stripe Customer Portal at https://dashboard.stripe.com/settings/billing/portal — turn it on, choose features, save.",
        stripeError: msg.slice(0, 200),
      },
      { status: 503 },
    );
  }
}
