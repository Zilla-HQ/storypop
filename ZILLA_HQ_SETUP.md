# Zilla HQ — one-time SEO setup

> Run this **once** for the entire Zilla portfolio. After it's done, every new merchant fork's SEO bootstrap (Inngest cron + admin button — see [SEO.md](./SEO.md)) is fully autonomous.
>
> Estimated time: **30 minutes**, never repeated.

This setup is what enables every `*.zilla.so` subdomain merchant (and every apex-domain merchant that opts in) to register itself with Google Search Console + Bing Webmaster + IndexNow without any manual operator step.

The trick is that GSC's **Domain property** verification is inheritable: if `zilla.so` is verified once, every URL-prefix property at `https://xyz.zilla.so/`, `https://abc.zilla.so/`, etc. can be added by the platform's OAuth credentials with no per-merchant verification step.

Bing's API works the same way — site ownership at the parent domain inherits to subdomains.

---

## 1. Verify zilla.so in Google Search Console (~5 min + DNS propagation)

This is human work in a browser, done once.

1. Open [search.google.com/search-console](https://search.google.com/search-console).
2. Click **Add property** → **Domain** (not URL prefix) → enter `zilla.so` → **Continue**.
3. Google shows you a TXT record to add to DNS. Copy it.
4. In Vercel, go to the domain tab for `zilla.so`. Add a TXT record at `@` with the Google verification value.
5. Wait ~5 min for DNS propagation. Click **Verify** in GSC.

When this verification succeeds, `zilla.so` becomes a Domain property in your GSC account. **All future subdomain URL-prefix properties (`https://xyz.zilla.so/`, etc.) inherit ownership from this verification** — added programmatically via the Search Console API in the merchant bootstrap flow, with no additional verification step.

## 2. Verify zilla.so in Bing Webmaster Tools (~5 min)

Similar flow:

1. Open [bing.com/webmasters](https://www.bing.com/webmasters) → sign in with the Microsoft account that will own all Zilla merchants.
2. **Add a site** → enter `https://zilla.so` (Bing supports a Domain-style add too — pick the one that says "Domain" or use URL Prefix and let inheritance work).
3. Pick verification method **DNS** if available, or **XML File**. DNS is preferred (matches GSC's pattern).
4. Verify.
5. Once verified, go to **Settings** → **API Access** → copy the API key.

Save the API key — you'll set it as `ZILLA_BING_WEBMASTER_API_KEY` in §4.

## 3. Provision the Google OAuth credentials (~15 min)

This is the credential the bootstrap uses to call the Search Console API. One-time setup at the Zilla platform level.

### 3.1 Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Project selector → **New Project** → name it `Zilla SEO Bootstrap` (or reuse an existing Zilla project).
3. **APIs & Services** → **Enabled APIs** → **+ Enable APIs and Services** → search and enable both:
   - **Google Search Console API** (a.k.a. Webmasters API)
   - **Site Verification API** (only needed if you ever want to programmatically verify per-merchant URL-prefix properties — most flows don't need it)

### 3.2 Configure the OAuth consent screen

1. **APIs & Services** → **OAuth consent screen** → **External** (or Internal if your Google Workspace covers all operators).
2. App name: `Zilla SEO Bootstrap`. Support email: yours. Developer contact: yours.
3. Scopes step → **Add or remove scopes** → search and select:
   - `https://www.googleapis.com/auth/webmasters` (full access — read + write to Search Console)
4. Test users: add your Google account email. (You'll publish later if you ever need to authorize from accounts not in your test list — for the bootstrap's single shared refresh token, "in testing" is fine forever.)

### 3.3 Create the OAuth client

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**.
2. Application type: **Desktop app**. Name: `Zilla SEO Bootstrap CLI`.
3. **Create**. Note the **Client ID** and **Client Secret**.

### 3.4 Mint the refresh token

The bootstrap uses a long-lived refresh token. Run this script once (you'll add it as `scripts/zilla-mint-gsc-refresh-token.mjs`):

```js
// scripts/zilla-mint-gsc-refresh-token.mjs
//
// Mint a long-lived refresh token for the GSC API, used by the
// merchant SEO bootstrap. One-time setup — store the resulting refresh
// token in the Zilla HQ vault.
//
// Usage:
//   ZILLA_GSC_OAUTH_CLIENT_ID=... \
//   ZILLA_GSC_OAUTH_CLIENT_SECRET=... \
//   node scripts/zilla-mint-gsc-refresh-token.mjs

import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.ZILLA_GSC_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.ZILLA_GSC_OAUTH_CLIENT_SECRET;
const REDIRECT = "http://localhost:8765/callback";
const SCOPE = "https://www.googleapis.com/auth/webmasters";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set ZILLA_GSC_OAUTH_CLIENT_ID + ZILLA_GSC_OAUTH_CLIENT_SECRET first.");
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
  const url = new URL(req.url, "http://localhost:8765");
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
    console.error("No refresh_token returned. Try revoking access at https://myaccount.google.com/permissions and re-running.");
    console.error(tokens);
    process.exit(1);
  }
  console.log("✓ Refresh token (store in vault as ZILLA_GSC_OAUTH_REFRESH_TOKEN):");
  console.log("");
  console.log(tokens.refresh_token);
});

server.listen(8765, () => {
  console.log("Open this URL in your browser, sign in with the Zilla HQ Google account that owns the zilla.so GSC property, and approve:");
  console.log("");
  console.log(authUrl);
  console.log("");
  exec(`open "${authUrl}"`); // macOS — falls through silently on other platforms
});
```

Run it:

```bash
ZILLA_GSC_OAUTH_CLIENT_ID="..." \
ZILLA_GSC_OAUTH_CLIENT_SECRET="..." \
node scripts/zilla-mint-gsc-refresh-token.mjs
```

A browser opens. Sign in **with the Google account that owns the verified zilla.so GSC property** (this is critical — the refresh token inherits that account's permissions). Approve. The refresh token prints to your terminal.

## 4. Store credentials in the platform vault

Drop these into 1Password / Vault / Vercel team-level env (NOT per-merchant — these are shared across the entire portfolio):

```
ZILLA_GSC_OAUTH_CLIENT_ID=<from §3.3>
ZILLA_GSC_OAUTH_CLIENT_SECRET=<from §3.3>
ZILLA_GSC_OAUTH_REFRESH_TOKEN=<from §3.4>
ZILLA_BING_WEBMASTER_API_KEY=<from §2>
```

Then propagate them to every merchant's Vercel project. Two options:

- **Manual** for now: copy/paste the four env vars into each merchant's Vercel env. Takes 60s per merchant.
- **Automated** later: a Zilla HQ script that uses Vercel's Team API to push the env vars into every project under `Zilla-HQ` automatically. See `scripts/propagate-zilla-env.mjs` (TODO — file an issue when this hurts).

## 5. Test against an existing merchant

Pick any merchant fork that's already deployed (e.g. Sitebeat). Set the four env vars in its Vercel project, redeploy, then visit `/admin/seo` and click **Run SEO bootstrap**.

Expected result: every step shows `ok` or `skipped (already present)`. If any step shows `error`, the message will identify which API failed:

| Error pattern | Fix |
|---|---|
| `GSC token refresh failed: HTTP 400 invalid_grant` | Refresh token revoked — re-run §3.4 with a fresh OAuth flow |
| `GSC addSite failed: HTTP 403` | The OAuth account doesn't own zilla.so. Re-do §1 + §3.4 from the right account. |
| `Bing addSite failed: HTTP 401` | Bing API key revoked or wrong. Regenerate at Bing Webmaster → Settings → API. |
| `Bing addSite failed: HTTP 200` with `Unauthorized` in body | Bing inheritance not active for this subdomain yet — manually add the merchant URL once via the Bing UI. |
| `IndexNow ping failed: HTTP 403 SiteVerificationNotCompleted` | The merchant's `public/<key>.txt` isn't deployed yet. Wait 5 min after deploy and retry. |

## 6. Verify the autonomous flow

After §5 succeeds for the first merchant:

1. Fork a brand-new merchant from the template (`Zilla-HQ/merchant-template` → `Zilla-HQ/<test>`).
2. Configure the merchant: set `NEXT_PUBLIC_APP_URL`, run `node scripts/generate-indexnow-key.mjs`, set the four `ZILLA_*` env vars. Deploy.
3. Wait until the next 04:00 UTC tick (or hit `/admin/seo` → **Run SEO bootstrap**).
4. Confirm in GSC that the new merchant's URL-prefix property now exists with sitemap submitted.
5. Confirm in Bing Webmaster that the site is added with sitemap submitted.

If all of that passes for a fresh merchant with zero human intervention beyond the env-var paste, the autonomous flow is live.

---

## 7. Rotating credentials

Refresh tokens don't expire by default but can be revoked:

- If `ZILLA_GSC_OAUTH_REFRESH_TOKEN` ever stops working: re-run §3.4 from the same Google account, replace the env var across every merchant.
- If `ZILLA_BING_WEBMASTER_API_KEY` is rotated: regenerate at Bing Webmaster → Settings → API, replace across every merchant.

A future automation should rotate these centrally via the Zilla HQ env-propagation script. For now, manual rotation is acceptable since rotation is rare.

## 8. Adding apex-domain merchants

The HQ credentials work for `*.zilla.so` because that domain is verified in GSC + Bing under the HQ account. Apex-domain merchants (e.g. `sitebeat.tech`, `realscale.app`) need their own verification:

- The merchant template's `app/layout.tsx` already supports per-merchant `NEXT_PUBLIC_GOOGLE_VERIFICATION` for the meta-tag fallback method.
- For apex merchants that want full autonomous bootstrap, mint a separate refresh token via §3.4 against the apex domain's verified GSC property and set `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN` in that merchant's Vercel env (overrides `ZILLA_GSC_OAUTH_REFRESH_TOKEN` per-merchant).

In practice most apex merchants will have a small enough surface that the operator can do GSC + Bing manually once via the SEO.md §2 runbook. Save the autonomous bootstrap effort for the high-volume `*.zilla.so` path.
