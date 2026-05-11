import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db, adminSettings } from "@/db";
import { eq } from "drizzle-orm";
import { exchangeCodeForTokens } from "@/lib/x-oauth";

export const runtime = "nodejs";

/**
 * GET /api/auth/x/callback?code=...&state=...
 *
 * X redirects here after the operator authorizes the brand account.
 * We verify the state matches the cookie we set in /start, exchange
 * the code for an access + refresh token, and persist the refresh
 * token to admin_settings so lib/x-poster.ts can mint short-lived
 * access tokens forever.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return errorPage(
      `X returned error: ${error} (${url.searchParams.get("error_description") ?? "no description"})`,
    );
  }
  if (!code || !state) {
    return errorPage("Missing code or state in callback URL");
  }

  const jar = await cookies();
  const expectedState = jar.get("x_oauth_state")?.value;
  const verifier = jar.get("x_oauth_verifier")?.value;
  if (!expectedState || !verifier) {
    return errorPage(
      "Auth cookies missing — the link expired or you opened it in a different browser. Re-run /api/auth/x/start.",
    );
  }
  if (state !== expectedState) {
    return errorPage("State mismatch — possible CSRF or stale flow. Re-run /api/auth/x/start.");
  }

  jar.delete("x_oauth_state");
  jar.delete("x_oauth_verifier");

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, verifier });
  } catch (err) {
    return errorPage(`Token exchange failed: ${(err as Error).message}`);
  }

  await db
    .update(adminSettings)
    .set({ xRefreshToken: tokens.refreshToken, updatedAt: new Date() })
    .where(eq(adminSettings.id, 1));

  return successPage(tokens.scope);
}

function htmlPage(body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>X Authorization</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 640px; margin: 80px auto; padding: 0 20px;
           color: #0f172a; line-height: 1.5; }
    h1 { font-size: 24px; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .ok { color: #047857; }
    .err { color: #b91c1c; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 16px; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function successPage(scope: string): NextResponse {
  return htmlPage(`
    <h1 class="ok">✓ X authorization complete</h1>
    <div class="card">
      <p>Refresh token saved. The merchant can now post + auto-reply via the X API.</p>
      <p>Scopes granted: <code>${scope}</code></p>
      <p>Next: head to <a href="/admin/x">/admin/x</a> to send a tweet, or tell the operator who triggered this flow that auth is done.</p>
    </div>
  `);
}

function errorPage(msg: string): NextResponse {
  return htmlPage(`
    <h1 class="err">✗ X authorization failed</h1>
    <div class="card">
      <p>${escapeHtml(msg)}</p>
      <p>Try again: <a href="/api/auth/x/start">restart the flow</a></p>
    </div>
  `);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
