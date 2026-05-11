"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db, adminSettings, orders } from "@/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
const ADMIN_DOMAINS = (process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHORIZED");
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  const domain = email?.split("@")[1];
  const allowed =
    email === ADMIN_EMAIL || (domain ? ADMIN_DOMAINS.includes(domain) : false);
  if (!allowed) throw new Error("FORBIDDEN");
}

type PauseKey =
  | "paused"
  | "discoveryPaused"
  | "qualificationPaused"
  | "previewPaused"
  | "outreachPaused"
  | "fulfillmentPaused"
  | "followupPaused";

export async function updatePauseFlag(key: PauseKey, value: boolean): Promise<void> {
  await requireAdmin();
  await db
    .update(adminSettings)
    .set({ [key]: value, updatedAt: new Date() })
    .where(eq(adminSettings.id, 1));
  revalidatePath("/admin");
}

export async function updatePricing(args: {
  standardCents: number;
  premiumCents: number;
  rushCents: number;
  dailySendCap: number;
  previewDailyCap: number;
  fulfillmentDailyBudgetCents: number;
}): Promise<void> {
  await requireAdmin();
  await db
    .update(adminSettings)
    .set({
      pricingStandardCents: args.standardCents,
      pricingPremiumCents: args.premiumCents,
      pricingRushCents: args.rushCents,
      dailySendCap: args.dailySendCap,
      previewDailyCap: args.previewDailyCap,
      fulfillmentDailyBudgetCents: args.fulfillmentDailyBudgetCents,
      updatedAt: new Date(),
    })
    .where(eq(adminSettings.id, 1));
  revalidatePath("/admin/settings");
}

export async function refundOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, error: "order not found" };
  if (!order.stripePaymentIntentId) return { ok: false, error: "no payment intent" };
  try {
    await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
    await db.update(orders).set({ status: "refunded" }).where(eq(orders.id, orderId));
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
