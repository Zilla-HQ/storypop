/**
 * Pull the full Stripe event timeline for a Payment Intent — every
 * webhook event that fired, in order, with timestamps. Used to diagnose
 * why fulfillment didn't kick off for an order.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-stripe-events.ts <pi_...>
 */
import Stripe from "stripe";

const PI = process.argv[2];
if (!PI?.startsWith("pi_")) {
  console.error("Usage: scripts/inspect-stripe-events.ts <pi_...>");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function main() {
  const pi = await stripe.paymentIntents.retrieve(PI, {
    expand: ["latest_charge.refunds.data.balance_transaction", "latest_charge.balance_transaction"],
  });

  const charge = pi.latest_charge as Stripe.Charge | null;

  console.log(`\n══ PAYMENT INTENT ${PI} ══`);
  console.log(`  Status:           ${pi.status}`);
  console.log(`  Amount:           $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
  console.log(`  Created:          ${new Date(pi.created * 1000).toISOString()}`);

  if (charge) {
    console.log(`\n══ LATEST CHARGE ${charge.id} ══`);
    console.log(`  Status:           ${charge.status}`);
    console.log(`  Created:          ${new Date(charge.created * 1000).toISOString()}`);
    console.log(`  Captured:         ${charge.captured}`);
    console.log(`  Paid:             ${charge.paid}`);
    console.log(`  Refunded:         ${charge.refunded}`);
    console.log(`  Amount refunded:  $${(charge.amount_refunded / 100).toFixed(2)}`);
    console.log(`  Failure code:     ${charge.failure_code ?? "(none)"}`);
    console.log(`  Failure msg:      ${charge.failure_message ?? "(none)"}`);
    console.log(`  Disputed:         ${charge.disputed ?? false}`);

    const refunds = charge.refunds?.data ?? [];
    if (refunds.length > 0) {
      console.log(`\n══ REFUNDS (${refunds.length}) ══`);
      for (const r of refunds) {
        console.log(`  ${r.id}`);
        console.log(`    Created:        ${new Date(r.created * 1000).toISOString()}`);
        console.log(`    Amount:         $${(r.amount / 100).toFixed(2)}`);
        console.log(`    Status:         ${r.status}`);
        console.log(`    Reason:         ${r.reason ?? "(none provided)"}`);
        console.log(`    Failure reason: ${r.failure_reason ?? "(none)"}`);
        const meta = Object.entries(r.metadata ?? {});
        if (meta.length > 0) {
          console.log(`    Metadata:`);
          for (const [k, v] of meta) console.log(`      ${k}: ${v}`);
        }
      }
    }
  }

  // Pull the full event log for this object — every webhook fired
  console.log(`\n══ EVENT TIMELINE ══`);
  const events = await stripe.events.list({
    type: undefined,
    limit: 100,
    created: {
      gte: pi.created - 60,  // 60s before PI created
    },
  });

  // Filter to events related to this PI or its objects
  const related = events.data.filter((e) => {
    const obj = e.data.object as unknown as Record<string, unknown>;
    if (!obj) return false;
    const objId = (obj.id as string) ?? "";
    if (objId === PI) return true;
    if (charge && objId === charge.id) return true;
    if (e.data.object && (e.data.object as unknown as Record<string, unknown>).payment_intent === PI) return true;
    if (charge && e.data.object && (e.data.object as unknown as Record<string, unknown>).charge === charge.id) return true;
    return false;
  });

  if (related.length === 0) {
    console.log(`  (no related events found in the last 100 — try pagination if older)`);
  } else {
    related.sort((a, b) => a.created - b.created);
    for (const e of related) {
      const ts = new Date(e.created * 1000).toISOString();
      const id = e.id;
      console.log(`  ${ts}  ${e.type.padEnd(40)} ${id}`);
    }
  }

  // Find checkout session → understand the customer journey
  if (charge) {
    console.log(`\n══ CHECKOUT SESSION ══`);
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: PI,
      limit: 1,
    });
    if (sessions.data[0]) {
      const s = sessions.data[0];
      console.log(`  ID:               ${s.id}`);
      console.log(`  Created:          ${new Date(s.created * 1000).toISOString()}`);
      console.log(`  Status:           ${s.status}`);
      console.log(`  Payment status:   ${s.payment_status}`);
      console.log(`  URL:              ${s.url ?? "(expired)"}`);
      console.log(`  Cust email:       ${s.customer_details?.email ?? "(none)"}`);
      console.log(`  Cust name:        ${s.customer_details?.name ?? "(none)"}`);
      console.log(`  Cust country:     ${s.customer_details?.address?.country ?? "(none)"}`);
      console.log(`  Mode:             ${s.mode}`);
      const meta = Object.entries(s.metadata ?? {});
      if (meta.length > 0) {
        console.log(`  Metadata:`);
        for (const [k, v] of meta) console.log(`    ${k}: ${v}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("\n✗", err);
  process.exit(1);
});

export {};
