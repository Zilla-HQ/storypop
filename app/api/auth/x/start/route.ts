import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/x-oauth";

export const runtime = "nodejs";

/**
 * GET /api/auth/x/start
 *
 * Kicks off the OAuth 2.0 PKCE flow. Generates state + code_verifier,
 * stashes both in short-lived HttpOnly cookies, and redirects the
 * operator to X's authorize page. The callback at /api/auth/x/callback
 * reads the cookies to verify state + complete the token exchange.
 *
 * Auth: this route MUST be hit by an operator who is logged into X as
 * the merchant's brand account in the same browser. The response is a
 * redirect, so just navigate to it directly.
 */
export async function GET() {
  const { url, state, verifier } = buildAuthorizeUrl();

  const jar = await cookies();
  jar.set("x_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  jar.set("x_oauth_verifier", verifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(url);
}
