/**
 * Dual-auth helper for admin endpoints.
 *
 * Admin actions can come from two principals:
 *   1. A signed-in operator (Clerk JWT) — interactive use from /admin
 *   2. A cron job / internal script (CRON_SECRET header) — non-interactive
 *
 * Wrap the body of any admin route handler in `requireAdminAuth(req)` and it
 * will return null if either path checks out, or a 401 NextResponse otherwise.
 *
 * Usage:
 *   const denied = await requireAdminAuth(req);
 *   if (denied) return denied;
 *   // ...rest of handler
 *
 * Required env: CRON_SECRET (used by Vercel Cron, internal scripts).
 * Required setup: Clerk middleware must populate the request — see middleware.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

const CRON_SECRET = env("CRON_SECRET", "")!;

export async function requireAdminAuth(req: NextRequest): Promise<NextResponse | null> {
  // Path 1: shared secret header (cron / scripts)
  const secret = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (CRON_SECRET && secret && timingSafeEq(secret, CRON_SECRET)) {
    return null;
  }

  // Path 2: Clerk JWT (interactive operator)
  try {
    const { userId } = await auth();
    if (userId) return null;
  } catch {
    // fall through
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
