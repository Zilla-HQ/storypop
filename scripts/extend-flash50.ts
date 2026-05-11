/**
 * Deactivate current FLASH50 (0 redemptions, 3h to expiry) and create
 * a fresh FLASH50 promo code on the same coupon with 48h expiry.
 * Same code, so banners + grader + emails keep working unchanged.
 */
import { stripe } from "@/lib/stripe";
async function main() {
  const list = await stripe.promotionCodes.list({ code: "FLASH50", limit: 5 });
  const current = list.data.find((p) => p.active);
  if (!current) {
    console.error("No active FLASH50 to extend");
    process.exit(1);
  }
  console.log(`Current FLASH50: ${current.id}  redeemed=${current.times_redeemed}/${current.max_redemptions}  expires=${current.expires_at}`);
  const couponId = typeof current.coupon === "string" ? current.coupon : current.coupon.id;

  // 1. Deactivate current (must be done before creating same-code new one).
  const deactivated = await stripe.promotionCodes.update(current.id, { active: false });
  console.log(`Deactivated old FLASH50: ${deactivated.id} active=${deactivated.active}`);

  // 2. Create fresh FLASH50, 48h expiry, same coupon, 10 spots.
  const newExpiry = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
  const fresh = await stripe.promotionCodes.create({
    code: "FLASH50",
    coupon: couponId,
    max_redemptions: 10,
    expires_at: newExpiry,
    active: true,
  });
  console.log(`Created fresh FLASH50: ${fresh.id} expires=${new Date(fresh.expires_at! * 1000).toISOString()} max=${fresh.max_redemptions}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
export {};
