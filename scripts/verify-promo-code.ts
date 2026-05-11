/**
 * Verify a Stripe promotion code is live and would actually apply at
 * checkout. Read-only — confirms what a customer would see if they
 * tried to redeem.
 *
 *   npx tsx --env-file=.env.local scripts/verify-promo-code.ts <CODE>
 */
import Stripe from "stripe";

const code = process.argv[2];
if (!code) {
  console.error("Usage: scripts/verify-promo-code.ts <CODE>");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function main() {
  const list = await stripe.promotionCodes.list({ code, limit: 5 });
  if (list.data.length === 0) {
    console.error(`✗ No Stripe promotion code found matching "${code}"`);
    process.exit(1);
  }

  for (const pc of list.data) {
    const coupon = await stripe.coupons.retrieve(pc.coupon.id);
    console.log(`\n══ PROMOTION CODE ${pc.id} ══`);
    console.log(`  Customer-facing code:  ${pc.code}`);
    console.log(`  Active:                ${pc.active ? "✓ YES" : "✗ NO"}`);
    console.log(`  Times redeemed:        ${pc.times_redeemed} / ${pc.max_redemptions ?? "∞"}`);
    console.log(`  Expires at:            ${pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : "(never)"}`);
    console.log(`  Customer:              ${pc.customer ?? "(any)"}`);
    console.log(`  Restrictions:          ${JSON.stringify(pc.restrictions ?? {})}`);

    console.log(`\n  Coupon ${coupon.id}:`);
    console.log(`    Name:                ${coupon.name ?? "(none)"}`);
    console.log(`    Active (valid):      ${coupon.valid ? "✓ YES" : "✗ NO"}`);
    console.log(`    Discount:            ${coupon.percent_off ? `${coupon.percent_off}% off` : `$${(coupon.amount_off ?? 0) / 100} off`}`);
    console.log(`    Duration:            ${coupon.duration}`);
    console.log(`    Redeem by:           ${coupon.redeem_by ? new Date(coupon.redeem_by * 1000).toISOString() : "(no limit)"}`);
    console.log(`    Times redeemed:      ${coupon.times_redeemed} / ${coupon.max_redemptions ?? "∞"}`);

    // Determine if it would actually be applied at checkout right now
    const reasons: string[] = [];
    if (!pc.active) reasons.push("promotion code inactive");
    if (!coupon.valid) reasons.push("coupon expired or fully redeemed");
    if (pc.expires_at && pc.expires_at * 1000 < Date.now()) reasons.push("promo code expired");
    if (pc.max_redemptions && pc.times_redeemed >= pc.max_redemptions) reasons.push("promo code at max redemptions");

    console.log(`\n  → CHECKOUT WOULD ${reasons.length === 0 ? "APPLY ✓" : "REJECT"}`);
    if (reasons.length > 0) {
      console.log(`    Reasons:`);
      for (const r of reasons) console.log(`      - ${r}`);
    } else {
      const sample$ = 79.0;
      const after = coupon.percent_off
        ? sample$ * (1 - coupon.percent_off / 100)
        : sample$ - (coupon.amount_off ?? 0) / 100;
      console.log(`    Effective price on $79 Tune-Up: $${after.toFixed(2)} (saves $${(sample$ - after).toFixed(2)})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗", err);
    process.exit(1);
  });

export {};
