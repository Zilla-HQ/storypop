import { NextRequest, NextResponse } from "next/server";
import { captureRefCookie, recordClick } from "@/lib/affiliate";

/**
 * Affiliate landing route. `/ref/JOE` drops the cookie + records a
 * status='clicked' row, then 302s to the homepage (or to ?to=<path>).
 *
 * Customize: the redirect target is `/` by default. Pass ?to=/l/abc to
 * route the click straight at a specific listing page — useful when a
 * partner is linking to a specific service.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const clean = (code ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  if (!clean) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = req.headers.get("user-agent");

  await Promise.all([
    captureRefCookie(clean),
    recordClick({ code: clean, ip, userAgent }),
  ]);

  const to = new URL(req.url).searchParams.get("to");
  const target = to && to.startsWith("/") ? to : "/";
  return NextResponse.redirect(new URL(target, req.url));
}
