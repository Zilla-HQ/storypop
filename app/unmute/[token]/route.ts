import { NextRequest, NextResponse } from "next/server";
import { verifyUnmuteToken } from "@/lib/unmute-token";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Customer permission flip for the spectacle layer.
 *
 * GET  /unmute/<token>  — render an HTML confirmation page
 *                         (currently returns plain text; replace with a
 *                         pretty Next.js page in production)
 * POST /unmute/<token>  — actually toggle listings.showPublicly
 *
 * Tokens are HMAC over `listingId|intent` (see lib/unmute-token.ts).
 * Intent is "show" or "hide". Customers can flip back and forth as
 * often as they like; the link lives forever as long as the merchant
 * keeps SHOW_PUBLICLY_SECRET stable.
 */

async function applyDecision(token: string): Promise<{ ok: boolean; message: string }> {
  const parsed = verifyUnmuteToken(token);
  if (!parsed) return { ok: false, message: "Invalid or expired link." };

  // Note: depends on a `showPublicly` column being present on listings.
  // Add it via:
  //   ALTER TABLE relist.listings
  //     ADD COLUMN show_publicly boolean NOT NULL DEFAULT false;
  // and extend db/schema.ts accordingly. The template doesn't add the
  // column inline because it requires a migration of an existing table.
  await db
    .update(listings)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ showPublicly: parsed.intent === "show" } as any)
    .where(eq(listings.id, parsed.listingId));

  return {
    ok: true,
    message:
      parsed.intent === "show"
        ? "Thanks — your business will now appear on our public live counter."
        : "Got it — your business has been hidden from the public live counter.",
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await applyDecision(token);
  return new NextResponse(`<!doctype html><meta charset=utf-8><title>Permission updated</title>
<body style="font-family:system-ui;padding:48px;max-width:560px;margin:auto;line-height:1.6">
<h1>${result.ok ? "✓" : "✗"} ${result.ok ? "Updated" : "Couldn't update"}</h1>
<p>${result.message}</p>
${result.ok ? `<p style="color:#64748b;font-size:14px">You can flip this anytime by reopening the link in your delivery email.</p>` : ""}
</body>`, {
    status: result.ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await applyDecision(token);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
