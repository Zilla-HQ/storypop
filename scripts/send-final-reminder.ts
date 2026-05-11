/**
 * Send a soft midday/late-day reminder to a refunded customer that
 * their recovery discount is still active. Third email in the recovery
 * sequence after the initial apology + the sample-image follow-up.
 *
 *   npx tsx --env-file=.env.local scripts/send-final-reminder.ts <pi_...>
 *
 * Tone: short, respectful, no pressure. Names the deadline clearly,
 * gives a one-click discount link, AND explicitly offers to issue a
 * fresh code later if today doesn't work — removes urgency, builds
 * trust. From + reply-to at jack@mail.restay.agency (no personal-email
 * leakage).
 */
import Stripe from "stripe";
import { Resend } from "resend";
import { db, listings, orders, previews } from "@/db";
import { eq, desc } from "drizzle-orm";
import { env } from "@/lib/env";

const PI = process.argv[2];
if (!PI?.startsWith("pi_")) {
  console.error("Usage: scripts/send-final-reminder.ts <pi_...>");
  process.exit(1);
}

const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);
const resend = new Resend(env("RESEND_API_KEY")!);
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM_ADDR = `jack@${FROM_DOMAIN}`;

async function main() {
  // ─── Customer info from Stripe ─────────────────────────────────────
  const pi = await stripe.paymentIntents.retrieve(PI, { expand: ["latest_charge"] });
  const charge = pi.latest_charge as Stripe.Charge | null;
  const email = charge?.billing_details?.email ?? charge?.receipt_email ?? null;
  const name = charge?.billing_details?.name ?? null;
  if (!email) {
    console.error("✗ No customer email");
    process.exit(1);
  }
  const firstName = name ? name.split(/\s+/)[0] : "there";

  // ─── Find the active recovery promo + expiry ──────────────────────
  const promos = await stripe.promotionCodes.list({ active: true, limit: 100 });
  const promo = promos.data.find(
    (p) => p.metadata?.related_pi === PI || p.code.startsWith("WELCOMEBACK"),
  );
  if (!promo) {
    console.error("✗ No active recovery promo for this customer");
    process.exit(1);
  }
  const expiresAt = promo.expires_at ? new Date(promo.expires_at * 1000) : null;
  if (!expiresAt) {
    console.error("✗ Promo has no expiry — likely permanent, no urgency to send a reminder");
    process.exit(1);
  }
  const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60_000));
  const hoursLeft = (minutesLeft / 60).toFixed(1);
  if (minutesLeft <= 0) {
    console.error("✗ Promo already expired");
    process.exit(1);
  }
  const expiryHuman = expiresAt.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const code = promo.code;
  const checkoutUrl = `${APP_URL}/?promo=${encodeURIComponent(code)}#paste`;

  // ─── Order context (for the share-friendly opener) ────────────────
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, PI))
    .limit(1);
  const [listing] = order
    ? await db.select().from(listings).where(eq(listings.id, order.listingId)).limit(1)
    : [null];
  const [preview] = listing
    ? await db.select().from(previews).where(eq(previews.listingId, listing.id)).orderBy(desc(previews.createdAt)).limit(1)
    : [null];
  const sampleAfter = preview?.enhancedPhotoUrls?.[0] ?? null;

  // ─── Compose ──────────────────────────────────────────────────────
  const subject = `${firstName ? firstName + ", " : ""}your Restay discount expires ${hoursLeft.startsWith("0") ? "in less than an hour" : `at ${expiryHuman}`} — no rush`;

  const text = `Hey ${firstName},

Quick midday note — your ${code} discount on the Restay Tune-Up is good for ~${hoursLeft} more hours (expires ${expiryHuman}).

If today works, the one-click checkout has the discount auto-applied:
${checkoutUrl}

If today doesn't work, just reply whenever and I'll issue you a fresh code — no expiration pressure. The point of the discount was to make right what we got wrong on the first attempt, not to box you into a deadline.

Either way, I'd genuinely love to hear what you'd want different from your listing — even a one-line note ("the hot tub photo isn't getting enough love" / "I want pickleball-led copy" / "show off the A-frame exterior more") gives me everything I need to make your Tune-Up land. Reply to this email anytime.

— Jack
Founder, Restay
${APP_URL}
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
<p>Hey ${firstName},</p>

<p>Quick midday note — your <code style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;background:#fef9c3;padding:2px 6px;border-radius:3px;font-weight:600;">${code}</code> discount on the Restay Tune-Up is good for <strong>~${hoursLeft} more hours</strong> (expires ${expiryHuman}).</p>

<p style="margin:18px 0;"><a href="${checkoutUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:14px;">Order with discount applied →</a></p>

${sampleAfter ? `<p style="margin:18px 0 8px;font-size:13px;color:#64748b;">Reminder of the restyle I sent yesterday — your actual photo, edit-only:</p>
<img src="${sampleAfter}" alt="Restay restyled photo of your listing" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:18px;" />` : ""}

<p><strong>If today doesn't work</strong>, just reply whenever and I'll issue you a fresh code — no expiration pressure. The point of the discount was to make right what we got wrong on the first attempt, not to box you into a deadline.</p>

<p>Either way, I'd genuinely love to hear what you'd want different from your listing — even a one-line note ("the hot tub photo isn't getting enough love" / "I want pickleball-led copy" / "show off the A-frame exterior more") gives me everything I need to make your Tune-Up land.</p>

<p><strong>Reply to this email anytime.</strong></p>

<p>— Jack<br/>Founder, Restay<br/><a href="${APP_URL}" style="color:#475569;">${APP_URL.replace(/^https?:\/\//, "")}</a></p>
</body></html>`;

  // ─── Send ─────────────────────────────────────────────────────────
  const result = await resend.emails.send({
    from: `Jack at Restay <${FROM_ADDR}>`,
    to: email,
    replyTo: FROM_ADDR,
    subject,
    text,
    html,
    headers: {
      "Idempotency-Key": `recovery-final-${order?.id ?? PI}`,
    },
    tags: [
      { name: "type", value: "recovery_final_reminder" },
      { name: "related_pi", value: PI.replace(/[^a-z0-9_]/gi, "_") },
    ],
  });

  if (result.error) {
    console.error("✗ Resend error:", result.error);
    process.exit(1);
  }

  console.log(`\n✓ Final reminder sent`);
  console.log(`  Resend ID: ${result.data?.id}`);
  console.log(`  To:        ${email}`);
  console.log(`  From:      ${FROM_ADDR}`);
  console.log(`  Reply-to:  ${FROM_ADDR}`);
  console.log(`  Subject:   ${subject}`);
  console.log(`  Discount:  ${code} (${hoursLeft}h remaining, expires ${expiryHuman})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗", err);
    process.exit(1);
  });

export {};
