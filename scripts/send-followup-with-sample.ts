/**
 * Send a personal follow-up email with the actual restyled preview
 * image of the customer's listing — converts an abstract pitch into
 * a concrete "this is what we'd do" demo.
 *
 *   npx tsx --env-file=.env.local scripts/send-followup-with-sample.ts <pi_...>
 *
 * Pulls the most recent preview row for the customer's listing,
 * embeds the watermarked enhanced photo URL into a personal email
 * inviting them to reply with what they actually want from the
 * full Tune-Up. Reminds them of the active discount + expiry.
 *
 * From / Reply-To: jack@<SENDER_DOMAINS[0]> — never personal.
 */
import Stripe from "stripe";
import { Resend } from "resend";
import { db, listings, orders, previews } from "@/db";
import { eq, desc } from "drizzle-orm";
import { env } from "@/lib/env";

const PI = process.argv[2];
if (!PI?.startsWith("pi_")) {
  console.error("Usage: scripts/send-followup-with-sample.ts <pi_...>");
  process.exit(1);
}

const STRIPE_KEY = env("STRIPE_SECRET_KEY")!;
const RESEND_KEY = env("RESEND_API_KEY")!;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const SENDER_DOMAINS = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency")
  .split(",").map((s) => s.trim()).filter(Boolean);
const FROM_DOMAIN = SENDER_DOMAINS[0] ?? "mail.restay.agency";
const FROM_ADDR = `jack@${FROM_DOMAIN}`;

const stripe = new Stripe(STRIPE_KEY);
const resend = new Resend(RESEND_KEY);

async function main() {
  // ─── 1. Pull customer email + name from Stripe ─────────────────────
  const pi = await stripe.paymentIntents.retrieve(PI, { expand: ["latest_charge"] });
  const charge = pi.latest_charge as Stripe.Charge | null;
  const email =
    charge?.billing_details?.email ?? charge?.receipt_email ?? null;
  const name = charge?.billing_details?.name ?? null;
  if (!email) {
    console.error("✗ No customer email found");
    process.exit(1);
  }
  const firstName = name ? name.split(/\s+/)[0] : "there";

  // ─── 2. Find the order + listing + most recent preview ─────────────
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, PI))
    .limit(1);
  if (!order) throw new Error(`No order for ${PI}`);

  const [listing] = await db.select().from(listings).where(eq(listings.id, order.listingId)).limit(1);
  if (!listing) throw new Error(`No listing for order`);

  const [preview] = await db
    .select()
    .from(previews)
    .where(eq(previews.listingId, listing.id))
    .orderBy(desc(previews.createdAt))
    .limit(1);

  if (!preview || preview.enhancedPhotoUrls.length === 0) {
    console.error("✗ No preview with enhanced photos available — regenerate first");
    process.exit(1);
  }

  const sampleAfter = preview.enhancedPhotoUrls[0];
  const sampleBefore = preview.originalPhotoUrls[0];
  console.log(`  Customer:  ${firstName} (${email})`);
  console.log(`  Listing:   ${listing.scrapedTitle}`);
  console.log(`  Sample:    ${sampleAfter}`);

  // ─── 3. Look up the active recovery promo for this customer ────────
  // Reuses the WELCOMEBACK code created earlier in
  // recover-refunded-customer.ts. We surface its current state (active +
  // expiry) directly into the email body.
  const recovered = await stripe.promotionCodes.list({ active: true, limit: 100 });
  const promo = recovered.data.find(
    (p) => p.metadata?.related_pi === PI || p.code.startsWith("WELCOMEBACK"),
  );
  if (!promo) {
    console.error("✗ No active recovery promo code found for this customer");
    process.exit(1);
  }
  const expiresAt = promo.expires_at
    ? new Date(promo.expires_at * 1000)
    : null;
  const expiresHuman = expiresAt
    ? expiresAt.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        timeZoneName: "short",
      })
    : "soon";
  const code = promo.code;
  const checkoutUrl = `${APP_URL}/?promo=${encodeURIComponent(code)}#paste`;

  // ─── 4. Build the email ────────────────────────────────────────────
  const subject = `Here's an actual restyled photo from your ${shortLocation(listing)} — your discount expires ${expiresAt ? "tonight" : "soon"}`;

  const text = `Hey ${firstName},

Pulled one of your A-frame photos through our restyle pipeline. Same room, same shot — re-graded for cinematic golden-hour daylight, restored shadow detail, polished surfaces. Edit-only, fully Airbnb-policy compliant. We never add or remove furniture.

See the watermarked sample here: ${sampleAfter}

If you order the full Tune-Up — $79 standard, or $71.10 with the discount below that expires ${expiresHuman} — you'll get this treatment on 10 of your photos, plus a rewritten title and description, plus a 30-day pricing report.

  Discount code: ${code}
  Click to apply automatically:
  ${checkoutUrl}

But before you order — I want to know what YOU want from this. Reply to this email and tell me:

  · Which 3–4 photos in your listing matter most (hot tub, mountain view, A-frame exterior at twilight, pickleball court, etc.)?
  · Any specific copy angles you want to lead with — pickleball-focused, design-focused, mountain-getaway-focused, large-group-friendly?
  · What you saw in the original preview that you wanted adjusted?

I'll personally handle your Tune-Up start to finish based on what you tell me. No bot, no support queue.

— Jack
Founder, Restay
${APP_URL}

---
Order ID: ${order.id}
Listing:  ${listing.listingUrl ?? "(unknown)"}
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${firstName},</p>

<p>Pulled one of your A-frame photos through our restyle pipeline so you can see exactly what we'd do. Same room, same shot — re-graded for cinematic golden-hour daylight, restored shadow detail, polished surfaces.</p>

<table cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:12px;width:100%;margin:16px 0;background:#f8fafc;overflow:hidden;">
  <tr>
    <td style="padding:0;">
      <img src="${sampleAfter}" alt="Restay restyled preview of your A-frame cabin photo" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px;" />
    </td>
  </tr>
  <tr>
    <td style="padding:10px 16px 14px;font-size:11px;color:#64748b;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;">
      Restay-restyled · Edit-only · Airbnb policy compliant
    </td>
  </tr>
</table>

<p>It's edit-only — we declutter, relight, color-grade, sky-replace. We never add or remove furniture, fixtures, or structural elements. <strong>Originals always retained.</strong></p>

<p>If you order the full Tune-Up — $79 standard, or <strong>$71.10 with the discount below</strong> that expires <strong>${expiresHuman}</strong> — you'll get this treatment on <strong>10 of your photos</strong>, plus a rewritten title and description, plus a 30-day pricing report.</p>

<table style="border:2px solid #0f172a;border-radius:8px;padding:18px 22px;background:#fef9c3;width:100%;margin:18px 0;">
<tr><td>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#0f172a;font-weight:700;">Your discount code</div>
<div style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;font-size:22px;font-weight:800;letter-spacing:0.05em;color:#0f172a;margin-top:6px;">${code}</div>
<div style="font-size:13px;color:#475569;margin-top:8px;">10% off · saves $7.90 · <strong>Expires ${expiresHuman}</strong></div>
<div style="margin-top:14px;"><a href="${checkoutUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;font-size:14px;">Order with discount applied →</a></div>
<div style="font-size:11px;color:#64748b;margin-top:8px;">Code auto-applies at checkout when you click the link.</div>
</td></tr>
</table>

<p><strong>But before you order — tell me what YOU want from this.</strong> Reply to this email with:</p>

<ul>
<li>Which <strong>3–4 photos</strong> in your listing matter most (hot tub, mountain view, A-frame exterior at twilight, pickleball court, etc.)?</li>
<li>Any specific <strong>copy angles</strong> you want to lead with — pickleball-focused, design-focused, mountain-getaway, large-group-friendly?</li>
<li>What you saw in the first preview that you wanted adjusted?</li>
</ul>

<p>I'll personally handle your Tune-Up start to finish based on what you tell me. No bot, no support queue — me.</p>

<p>— Jack<br/>Founder, Restay<br/><a href="${APP_URL}" style="color:#475569;">${APP_URL.replace(/^https?:\/\//, "")}</a></p>

<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;"/>
<p style="font-size:11px;color:#94a3b8;">Order ID: <code style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;">${order.id}</code>${listing.listingUrl ? `<br/>Listing: <a href="${listing.listingUrl}" style="color:#94a3b8;">${listing.listingUrl}</a>` : ""}</p>
</body></html>`;

  // ─── 5. Send via Resend ────────────────────────────────────────────
  const result = await resend.emails.send({
    from: `Jack at Restay <${FROM_ADDR}>`,
    to: email,
    replyTo: FROM_ADDR,
    subject,
    text,
    html,
    headers: {
      "Idempotency-Key": `recovery-followup-${order.id}`,
    },
    tags: [
      { name: "type", value: "recovery_followup" },
      { name: "related_pi", value: PI.replace(/[^a-z0-9_]/gi, "_") },
    ],
  });

  if (result.error) {
    console.error("✗ Resend error:", result.error);
    process.exit(1);
  }

  console.log(`\n✓ Follow-up sent`);
  console.log(`  Resend ID: ${result.data?.id}`);
  console.log(`  To:        ${email}`);
  console.log(`  From:      ${FROM_ADDR}`);
  console.log(`  Reply-to:  ${FROM_ADDR}`);
  console.log(`  Subject:   ${subject}`);
  console.log(`  Sample:    ${sampleAfter}`);
  console.log(`  Discount:  ${code} (expires ${expiresHuman})`);
}

function shortLocation(l: { city: string | null; state: string | null }): string {
  if (!l.city) return "listing";
  return l.state ? `${l.city}, ${l.state}` : l.city;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗", err);
    process.exit(1);
  });

export {};
