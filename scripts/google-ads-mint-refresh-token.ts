/**
 * One-shot: mint a long-lived Google Ads API refresh token.
 *
 *   GOOGLE_ADS_CLIENT_ID=...  GOOGLE_ADS_CLIENT_SECRET=...  \
 *     npx tsx scripts/google-ads-mint-refresh-token.ts
 *
 * Flow:
 *   1. Spawns a local HTTP server on a free port (loopback redirect).
 *   2. Opens Google's OAuth consent in your default browser.
 *   3. Receives the auth code on the loopback redirect.
 *   4. Exchanges code → refresh + access tokens.
 *   5. Prints the refresh token. Save as GOOGLE_ADS_REFRESH_TOKEN.
 *
 * Refresh tokens never expire (until revoked), so you only run this once
 * per merchant. Add the printed token to Vercel env and to .env.local.
 *
 * No npm deps — uses node's built-in http + crypto + fetch.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import type { AddressInfo } from "node:net";

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/adwords";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET as env vars.\n\n" +
      "  GOOGLE_ADS_CLIENT_ID=...apps.googleusercontent.com \\\n" +
      "  GOOGLE_ADS_CLIENT_SECRET=GOCSPX-... \\\n" +
      "    npx tsx scripts/google-ads-mint-refresh-token.ts",
  );
  process.exit(1);
}

const state = randomUUID();

function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn(`(Couldn't auto-open browser. Open manually: ${url})`);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost`);
  if (url.pathname !== "/") {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    res.setHeader("content-type", "text/html");
    res.end(`<h1>OAuth error: ${error}</h1><p>Close this tab.</p>`);
    console.error(`\n✗ OAuth error: ${error}`);
    server.close();
    process.exit(1);
  }
  if (!code || returnedState !== state) {
    res.statusCode = 400;
    res.end("Missing/invalid code or state");
    return;
  }

  const port = (server.address() as AddressInfo).port;
  const redirectUri = `http://localhost:${port}`;

  // Exchange the code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokens = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || tokens.error) {
    res.setHeader("content-type", "text/html");
    res.end(
      `<h1>Token exchange failed</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>`,
    );
    console.error(
      `\n✗ Token exchange failed: ${tokens.error_description ?? tokens.error}`,
    );
    server.close();
    process.exit(1);
  }

  if (!tokens.refresh_token) {
    res.setHeader("content-type", "text/html");
    res.end(
      `<h1>No refresh token returned</h1><p>Google only returns a refresh token on first consent. Revoke the existing grant at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> and re-run.</p>`,
    );
    console.error(
      "\n✗ No refresh_token in response. Likely you've already authorized this client. " +
        "Revoke at https://myaccount.google.com/permissions then re-run.",
    );
    server.close();
    process.exit(1);
  }

  res.setHeader("content-type", "text/html");
  res.end(
    `<h1 style="font-family:system-ui">✓ Refresh token minted</h1>` +
      `<p>You can close this tab. Token is in your terminal.</p>`,
  );

  console.log("\n────────────────────────────────────────");
  console.log("✓ Refresh token (paste into Vercel env + .env.local):\n");
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("────────────────────────────────────────\n");

  server.close();
  process.exit(0);
});

server.listen(0, "127.0.0.1", () => {
  const port = (server.address() as AddressInfo).port;
  const redirectUri = `http://localhost:${port}`;
  const consentUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  consentUrl.searchParams.set("client_id", CLIENT_ID);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("response_type", "code");
  consentUrl.searchParams.set("scope", SCOPE);
  consentUrl.searchParams.set("access_type", "offline");
  consentUrl.searchParams.set("prompt", "consent"); // forces refresh_token to be returned
  consentUrl.searchParams.set("state", state);

  console.log(`Listening on ${redirectUri}`);
  console.log(
    `\nOpening Google consent page in your browser...\nIf it doesn't open, visit:\n${consentUrl.toString()}\n`,
  );
  openBrowser(consentUrl.toString());
});

export {};
