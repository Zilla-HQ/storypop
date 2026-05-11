# AFFILIATE.md — Affiliate / referral program

A copy-the-link affiliate engine. Partner gets a personalized URL, every click is tracked, every purchase is attributed, payouts are owed monthly.

## How it works

```
Partner shares link  →  https://<merchant>/ref/JOE
                        │
                        ▼
                  app/ref/[code]/route.ts
                        │
            ┌───────────┴──────────┐
            ▼                      ▼
   ref_code cookie set       referrals row inserted
   (90 days, sameSite=lax)   { code: 'JOE', status: 'clicked', ip, ua }
            │
            ▼
   User browses, hits checkout
            │
   /api/checkout reads cookie, attaches to Stripe Checkout metadata
            │
            ▼
   Stripe webhook (checkout.session.completed)
            │
            ▼
   referrals row inserted
   { code: 'JOE', status: 'purchased', amountCents, orderId }
```

## Tier ladder

Configurable in `lib/affiliate.ts:AFFILIATE_TIERS`. Default (matches SiteGrid):

| Sales count | Tier | Payout per sale |
|---|---|---|
| 1–4 | Standard | $50 |
| 5–9 | Silver | $100 |
| 10+ | Gold | $250 |

`tierForSaleCount(n)` returns the right tier for any sales count. Payout for a single sale = tier-for-(saleCount-1).payoutCents at the time the sale happened — i.e. a partner who just hit Silver at sale 5 earns $100 on that 5th sale.

## Wiring the Stripe path

In your checkout-create handler (e.g. `app/api/checkout/route.ts`):

```ts
import { readRefCookie } from "@/lib/affiliate";

const refCode = await readRefCookie();
const session = await stripe.checkout.sessions.create({
  // ...
  metadata: {
    listing_id: listingId,
    ...(refCode ? { ref_code: refCode } : {}),
  },
});
```

In the Stripe webhook (e.g. `app/api/stripe/webhook/route.ts`):

```ts
import { recordPurchase } from "@/lib/affiliate";

if (event.type === "checkout.session.completed") {
  const session = event.data.object;
  const refCode = session.metadata?.ref_code;
  if (refCode) {
    await recordPurchase({
      code: refCode,
      orderId: session.metadata?.order_id,
      amountCents: session.amount_total ?? 0,
    });
  }
}
```

## Operator surfaces

- **`/api/admin/referrals`** — JSON leaderboard. Gate via the same Clerk middleware that protects `/admin/*`.
- **Public stats per partner** — call `statsForCode("JOE")` for a partner-facing dashboard.
- **Embed widget** — `/widget/footer.js?data-slug=<slug>` appends a "Made by ..." link with `?ref=site-<slug>` to every customer-built site. Free organic attribution.

## Payouts

The library tracks owed amounts; **actual payouts are operator-side**. Suggested cadence: 1st of each month via Wise / Venmo / Stripe Connect, conditional on a $25 minimum (skip and roll over below threshold).

## First-N cash bonus (manual)

A common growth lever: a one-time bonus for the first N affiliates to sign up — e.g. $250 cash on first confirmed sale. **Keep this manual** — don't bake it into the library. Once you mix one-off bonuses with the automated payout calc, audit + dispute resolution gets painful. Track them in a Notion page or a spreadsheet alongside the monthly export.

## What this doesn't do

- No partner-facing portal — they ask for stats by email or you build it.
- No second-level (sub-affiliate) commissions. Adding them would require a `parent_code` column on `referrals` plus the right payout cascade — not built.
- No fraud detection. A partner could click their own link before buying. In practice the cookie-window + manual review on monthly payout is enough; add IP-based dedup if it becomes a problem.
