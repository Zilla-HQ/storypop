/**
 * One-shot: send a 10%-off recovery email to a customer who refunded.
 *
 *   npx tsx --env-file=.env.local scripts/recover-refunded-customer.ts <pi_...>
 *
 * 1. Pulls customer email from the Stripe Payment Intent
 * 2. Creates a 10% off coupon (one-time, expires end-of-day UTC today)
 * 3. Generates a promotion code attached to that coupon
 * 4. Sends a personal recovery email via Resend with the code + a
 *    pre-built checkout link that auto-applies the discount
 *
 * Read-only side effects: Stripe coupon + promotion code creation, one
 * Resend email send. No DB writes.
 */
import Stripe from "stripe";
import { Resend } from "resend";

const PI = process.argv[2];
if (!PI?.startsWith("pi_")) {
  console.error("Usage: scripts/recover-refunded-customer.ts <pi_...>");
  process.exit(1);
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;
const RESEND_KEY = process.env.RESEND_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency";
const FROM_DOMAIN = (process.env.SENDER_DOMAINS ?? "mail.restay.agency").split(",")[0];

if (!STRIPE_KEY || !RESEND_KEY) {
  console.error("Need STRIPE_SECRET_KEY + RESEND_API_KEY in env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY);
const resend = new Resend(RESEND_KEY);

async function main() {
  // ─── 1. Pull customer email from Stripe ────────────────────────────
  console.log(`Fetching ${PI} from Stripe...`);
  const pi = await stripe.paymentIntents.retrieve(PI, {
    expand: ["latest_charge", "customer"],
  });

  const charge = pi.latest_charge as Stripe.Charge | null;
  const email =
    charge?.billing_details?.email ??
    charge?.receipt_email ??
    (pi.customer && typeof pi.customer === "object" && !pi.customer.deleted
      ? pi.customer.email
      : null);

  if (!email) {
    console.error("✗ No customer email found on this Payment Intent.");
    console.error("  Stripe metadata:", JSON.stringify(pi.metadata, null, 2));
    process.exit(1);
  }
  const name = charge?.billing_details?.name ?? null;
  console.log(`  Email: ${email}`);
  if (name) console.log(`  Name:  ${name}`);

  // ─── 2. Create a 10% coupon expiring at end-of-day UTC ────────────
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);
  const couponName = `Recovery 10% off — ${PI.slice(0, 12)}`;
  const coupon = await stripe.coupons.create({
    percent_off: 10,
    duration: "once",
    name: couponName,
    redeem_by: Math.floor(endOfDay.getTime() / 1000),
    max_redemptions: 1,
    metadata: { source: "recovery_email", related_pi: PI },
  });
  console.log(`  Coupon created: ${coupon.id} (10% off, max 1 redemption, expires ${endOfDay.toISOString()})`);

  // ─── 3. Promotion code (the human-readable thing) ─────────────────
  const codeStr = `WELCOMEBACK${Math.floor(Math.random() * 9000) + 1000}`;
  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: codeStr,
    expires_at: Math.floor(endOfDay.getTime() / 1000),
    max_redemptions: 1,
    metadata: { source: "recovery_email", related_pi: PI },
  });
  console.log(`  Promo code: ${codeStr} → ${promo.id}`);

  // ─── 4. Build the email ────────────────────────────────────────────
  const firstName = name ? name.split(/\s+/)[0] : null;
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";

  const checkoutUrl = `${APP_URL}/?promo=${encodeURIComponent(codeStr)}#paste`;

  const subject = "Your Restay refund — let's make this right";
  const text = `${greeting}

Saw the refund come through on your Restay order. Sorry the experience didn't land — that's on us, not you.

I want to make this right. I'm sending you a 10% discount good through end-of-day today (${endOfDay.toUTCString()}):

  Code: ${codeStr}
  Apply at checkout — it shaves $7.90 off the standard $79 Tune-Up.
  Or use this direct link: ${checkoutUrl}

Beyond the discount: I'll personally work with you over email on your listing. If anything in the audit doesn't look right, or you want a specific angle re-tried (different photo, different copy direction, different pricing comp window), just reply to this email and I'll handle it directly. No bot, no support queue — me.

We refund every Tune-Up that doesn't meet the bar. The whole point of the 14-day window is so you have zero downside trying. The first round wasn't right; let's try again.

Reply with any URL and I'll get on it tonight.

— Jack
Founder, Restay
restay.agency
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>${greeting}</p>

<p>Saw the refund come through on your Restay order. Sorry the experience didn't land — that's on us, not you.</p>

<p>I want to make this right. I'm sending you a 10% discount good through end-of-day today:</p>

<table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;background:#f8fafc;width:100%;margin:14px 0;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:600;">Discount code</div>
<div style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;font-size:18px;font-weight:700;letter-spacing:0.05em;color:#0f172a;margin-top:4px;">${codeStr}</div>
<div style="font-size:13px;color:#475569;margin-top:8px;">Apply at checkout — shaves $7.90 off the $79 Tune-Up. <strong>Expires ${endOfDay.toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET.</strong></div>
<div style="margin-top:12px;"><a href="${checkoutUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">Try again with discount applied →</a></div>
</td></tr>
</table>

<p><strong>Beyond the discount:</strong> I'll personally work with you over email on your listing. If anything in the audit didn't look right, or you want a specific angle re-tried (different photo, different copy direction, different pricing comp window), just reply to this email and I'll handle it directly. No bot, no support queue — me.</p>

<p>We refund every Tune-Up that doesn't meet the bar. The whole point of the 14-day window is so you have zero downside trying. The first round wasn't right; let's try again.</p>

<p>Reply with any URL and I'll get on it tonight.</p>

<p>— Jack<br/>Founder, Restay<br/><a href="${APP_URL}" style="color:#475569;">restay.agency</a></p>
</body></html>`;

  // ─── 5. Send via Resend ────────────────────────────────────────────
  const replyTo = process.env.OPERATOR_EMAIL ?? process.env.REPLIES_EMAIL ?? "jack@seifdn.org";
  const send = await resend.emails.send({
    from: `Jack at Restay <jack@${FROM_DOMAIN}>`,
    to: email,
    replyTo,
    subject,
    text,
    html,
    tags: [
      { name: "type", value: "recovery" },
      { name: "related_pi", value: PI.replace(/[^a-z0-9_]/gi, "_") },
    ],
  });

  if (send.error) {
    console.error("✗ Resend error:", send.error);
    process.exit(1);
  }

  console.log(`\n✓ Email sent`);
  console.log(`  Resend ID: ${send.data?.id}`);
  console.log(`  To:        ${email}`);
  console.log(`  Reply-to:  ${replyTo}`);
  console.log(`  Subject:   ${subject}`);
  console.log(`  Code:      ${codeStr} (10% off, expires end of today UTC)`);
}

main().catch((err) => {
  console.error("\n✗", err);
  process.exit(1);
});

export {};
