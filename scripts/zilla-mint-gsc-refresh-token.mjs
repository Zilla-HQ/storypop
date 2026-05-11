#!/usr/bin/env node
/**
 * Mint a long-lived OAuth refresh token for the Google Search Console
 * API. Used by the per-merchant SEO bootstrap. ONE-TIME setup at the
 * Zilla HQ level — store the resulting refresh token in the platform
 * vault, then propagate to every merchant's Vercel env as
 * ZILLA_GSC_OAUTH_REFRESH_TOKEN.
 *
 * See ZILLA_HQ_SETUP.md §3 for the full context. Pre-conditions:
 *   - zilla.so verified as Domain property in GSC (§1)
 *   - Google Cloud OAuth Desktop client created (§3.3)
 *
 * Usage:
 *   ZILLA_GSC_OAUTH_CLIENT_ID="..." \
 *   ZILLA_GSC_OAUTH_CLIENT_SECRET="..." \
 *   node scripts/zilla-mint-gsc-refresh-token.mjs
 *
 * Output: prints a refresh token to stdout. Save it.
 */

import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.ZILLA_GSC_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.ZILLA_GSC_OAUTH_CLIENT_SECRET;
const REDIRECT = "http://localhost:8765/callback";
const SCOPE = "https://www.googleapis.com/auth/webmasters";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set ZILLA_GSC_OAUTH_CLIENT_ID and ZILLA_GSC_OAUTH_CLIENT_SECRET in your shell first.",
  );
  console.error("See ZILLA_HQ_SETUP.md §3.3 for how to create these.");
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost:8765");
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("missing code");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>OK — return to your terminal</h1>");
  server.close();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    console.error(
      "No refresh_token returned. Try revoking access at https://myaccount.google.com/permissions and re-running with prompt=consent.",
    );
    console.error(tokens);
    process.exit(1);
  }
  console.log("");
  console.log("=== Refresh token (store as ZILLA_GSC_OAUTH_REFRESH_TOKEN) ===");
  console.log("");
  console.log(tokens.refresh_token);
  console.log("");
  console.log("Add this to:");
  console.log("  1. Your platform vault (1Password / shared secrets)");
  console.log("  2. Every merchant's Vercel env (or run a propagate-env script)");
});

server.listen(8765, () => {
  console.log("Open this URL in your browser:");
  console.log("");
  console.log(`  ${authUrl}`);
  console.log("");
  console.log(
    "Sign in with the Google account that owns the verified zilla.so GSC property. Approve.",
  );
  // Try to auto-open on macOS; silently no-op elsewhere.
  exec(`open "${authUrl}"`);
});
