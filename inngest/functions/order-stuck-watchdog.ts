import { inngest } from "@/inngest/client";
import { db, orders } from "@/db";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { sendOperatorAlert } from "@/lib/operator-alerts";
import { env } from "@/lib/env";

/**
 * Watchdog cron — every 5 minutes, scan for orders stuck in `paid` state
 * for more than `STUCK_THRESHOLD_MIN` minutes. For each stuck order:
 *   1. Re-fire `orders/paid` to retry the fulfillment function (the
 *      original event may have failed silently — provider out of credits,
 *      Inngest retry exhaustion, etc.)
 *   2. Email the operator so they're aware
 *
 * Twin of `preview-stuck-watchdog` — different funnel stage, same idea.
 *
 * This exists because of the Restay-William incident (META_ADS.md §5b):
 * paid order, no Inngest dispatch, 17 minutes of silence, customer
 * refunded. Once that pattern was understood, the fix was to monitor +
 * retry within 5 minutes of any paid order that doesn't kick off
 * fulfillment.
 *
 * Idempotency: re-firing `orders/paid` is safe. The fulfillment function
 * checks `order.status !== "paid"` at the top and short-circuits if a
 * parallel run already moved status to `fulfilling` or `fulfilled`.
 */

const STUCK_THRESHOLD_MIN = parseInt(env("ORDER_STUCK_THRESHOLD_MIN", "5") ?? "5", 10);
const ALERT_THRESHOLD_MIN = parseInt(env("ORDER_ALERT_THRESHOLD_MIN", "5") ?? "5", 10);

export const orderStuckWatchdogFn = inngest.createFunction(
  {
    id: "order-stuck-watchdog",
    name: "Watchdog — stuck-in-paid orders",
    concurrency: { limit: 1 },
  },
  { cron: "*/5 * * * *" },
  async ({ step, logger }) => {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000);

    const stuck = await step.run("find-stuck-orders", async () => {
      return await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, "paid"),
            isNull(orders.fulfilledAt),
            lt(orders.paidAt, cutoff),
          ),
        );
    });

    if (stuck.length === 0) return { stuck: 0 };

    logger.warn(`Found ${stuck.length} stuck-in-paid orders (>${STUCK_THRESHOLD_MIN} min)`);

    for (const order of stuck) {
      const paidAtRaw = order.paidAt as unknown;
      const paidAtMs = paidAtRaw
        ? typeof paidAtRaw === "string"
          ? Date.parse(paidAtRaw)
          : paidAtRaw instanceof Date
            ? paidAtRaw.getTime()
            : null
        : null;
      const stuckMinutes = paidAtMs ? Math.round((Date.now() - paidAtMs) / 60_000) : 0;

      // Re-fire `orders/paid` to retry fulfillment.
      await step.sendEvent(`retry-fulfillment-${order.id}`, {
        name: "orders/paid",
        data: { orderId: order.id },
      });
      logger.info(`Re-fired orders/paid for ${order.id} (stuck ${stuckMinutes}m)`);

      // Alert the operator if past the alert threshold.
      if (stuckMinutes >= ALERT_THRESHOLD_MIN) {
        await step.run(`alert-${order.id}`, async () => {
          await sendOperatorAlert({
            subject: `⚠ Order ${order.id.slice(0, 8)} stuck in paid for ${stuckMinutes}m`,
            summary: `An order has been sitting in status="paid" without fulfillment for ${stuckMinutes} minutes. The watchdog has re-fired orders/paid to retry. If this fires again in 5 minutes, fulfillment is failing silently — check the Inngest dashboard for the orders/paid event with this orderId. Customer is at risk of refunding due to silence.`,
            details: `Order ID:        ${order.id}
Listing ID:      ${order.listingId}
Tier:            ${order.tier}
Amount:          $${(order.amountCents / 100).toFixed(2)}
Customer email:  ${order.customerEmail ?? "(not on order — check Stripe)"}
Stripe PI:       ${order.stripePaymentIntentId ?? "(none)"}
Paid at:         ${paidAtMs ? new Date(paidAtMs).toISOString() : "(unknown)"}
Now:             ${new Date().toISOString()}`,
          });
        });
      }
    }

    return { stuck: stuck.length, retried: stuck.map((o) => o.id) };
  },
);

/**
 * Diagnostic helper for /admin readiness checklist.
 */
export async function countStuckPaidOrders(thresholdMinutes = STUCK_THRESHOLD_MIN): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        isNull(orders.fulfilledAt),
        lt(orders.paidAt, cutoff),
      ),
    );
  return Number(row?.n ?? 0);
}
