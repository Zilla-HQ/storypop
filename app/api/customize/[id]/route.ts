/**
 * Token-gated post-purchase customization endpoint.
 *
 * GET  — returns the current customizable fields for a paid order
 * POST — updates them (only the customer who bought, only after purchase)
 *
 * Auth model: HMAC token in the URL (`?t=<token>`), signed against
 * `{listingId}:{customerEmail}` by lib/customize-token.ts. No session required.
 *
 * Why no session: customers paid by email, may come back days/weeks later
 * from a different device. A token in the post-purchase email is the lowest-
 * friction return path. Tokens don't expire — invalidation = rotate
 * CUSTOMIZE_SECRET (which kills every existing token).
 *
 * Security model:
 *   - Token authenticates the user holds the email associated with the order
 *   - We confirm the order is in a "purchased" state (not draft / failed)
 *   - HMAC is constant-time compared to prevent timing attacks
 *   - Token leak = single-customer exposure (acceptable trade vs login UX)
 *
 * To plug into your schema: this route assumes an `orders` table with
 * `customerEmail` and `status` fields. Adapt to your customizable-entity
 * (listings, sites, sites-by-slug, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, orders } from "@/db";
import { eq } from "drizzle-orm";
import { signCustomizeToken, verifyCustomizeToken } from "@/lib/customize-token";

export const runtime = "nodejs";

async function authorize(req: NextRequest, id: string) {
  const token = req.nextUrl.searchParams.get("t") || req.headers.get("x-customize-token") || "";
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (order.status !== "fulfilled" && order.status !== "paid") {
    return { error: NextResponse.json({ error: "order is not in a customizable state" }, { status: 403 }) };
  }
  if (!order.customerEmail) {
    return { error: NextResponse.json({ error: "order has no customer email" }, { status: 403 }) };
  }
  const verifiedId = verifyCustomizeToken(token, order.customerEmail);
  if (verifiedId !== id) {
    return { error: NextResponse.json({ error: "invalid token" }, { status: 401 }) };
  }
  return { order };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await authorize(req, id);
  if (result.error) return result.error;
  const { order } = result;

  // Adapt the returned shape to whatever your customizable fields are.
  return NextResponse.json({
    id: order.id,
    customerEmail: order.customerEmail,
    customizations: (order as any).customizations ?? {},
  });
}

const updateSchema = z.object({
  customizations: z.record(z.unknown()),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await authorize(req, id);
  if (result.error) return result.error;
  const { order } = result;

  let body: z.infer<typeof updateSchema>;
  try {
    body = updateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid body", detail: String(err) }, { status: 400 });
  }

  // Merge — never replace, so a partial update doesn't wipe other fields.
  const merged = { ...((order as any).customizations ?? {}), ...body.customizations };

  await db.update(orders).set({ customizations: merged } as any).where(eq(orders.id, id));

  // Return a fresh token so the client can store it and skip re-fetching from email.
  const newToken = signCustomizeToken(id, order.customerEmail!);

  return NextResponse.json({
    ok: true,
    id,
    customizations: merged,
    token: newToken,
  });
}
