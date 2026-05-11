/**
 * X (Twitter) OAuth 2.0 with PKCE — confidential client flow.
 *
 * Architecture (Polsia / Meta-Ads pattern): one Zilla HQ X dev app
 * (X_CLIENT_ID + X_CLIENT_SECRET shared across the portfolio) +
 * per-merchant brand-account refresh token stored in admin_settings.
 *
 * One-time auth: operator clicks `/api/auth/x/start` while logged into
 * X as the merchant's brand account, gets redirected to X to authorize,
 * then X redirects back to `/api/auth/x/callback?code=...` which
 * exchanges the code for a refresh token and writes it to
 * admin_settings.x_refresh_token.
 *
 * After that, every tweet send mints a fresh short-lived access token
 * from the refresh token (the access token expires after ~2h).
 *
 * Required env (shared across all Zilla merchants — see ZILLA_HQ_SETUP.md §X):
 *   X_CLIENT_ID
 *   X_CLIENT_SECRET
 */

import crypto from "node:crypto";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const SCOPE = "tweet.read tweet.write users.read offline.access";

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL not set — required for X OAuth callback URL");
  }
  return url.replace(/\/$/, "");
}

function callbackUri(): string {
  return `${appUrl()}/api/auth/x/callback`;
}

export function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("X_CLIENT_ID / X_CLIENT_SECRET not set in env");
  }
  return { clientId, clientSecret };
}

/**
 * Generate the PKCE code_verifier (random) and code_challenge (sha256 of verifier, base64url).
 */
function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Build the X authorize URL. Returns the URL plus the verifier and
 * state, both of which the caller must persist (cookie, DB, in-memory)
 * to use during the callback exchange.
 */
export function buildAuthorizeUrl(): { url: string; state: string; verifier: string } {
  const { clientId } = clientCredentials();
  const state = base64url(crypto.randomBytes(16));
  const { verifier, challenge } = generatePkcePair();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUri(),
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return {
    url: `${AUTHORIZE_URL}?${params.toString()}`,
    state,
    verifier,
  };
}

/**
 * Exchange an auth code for tokens. Returns the response (which
 * includes access_token, refresh_token, expires_in).
 */
export async function exchangeCodeForTokens(args: {
  code: string;
  verifier: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}> {
  const { clientId, clientSecret } = clientCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: callbackUri(),
    code_verifier: args.verifier,
    client_id: clientId,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`token exchange failed: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  const json = JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

/**
 * Use a refresh token to mint a fresh access token. X may rotate the
 * refresh token; if so we return the new one too — caller persists.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = clientCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`refresh failed: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  const json = JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in,
  };
}
