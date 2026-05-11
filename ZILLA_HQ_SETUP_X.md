# Zilla HQ — one-time X (Twitter) setup

> Run this **once** for the entire Zilla portfolio. After it's done, every new merchant fork's X integration (post + auto-reply — see [X.md](./X.md)) is fully autonomous.
>
> Estimated time: **30 minutes**, never repeated.

This setup is what enables every merchant fork to post tweets + auto-reply to @mentions from its own brand X account, sharing one HQ-level X dev app. Same pattern as `ZILLA_HQ_SETUP.md` (SEO) and `ZILLA_HQ_SETUP_META.md` (Meta Ads).

---

## 1. Create the Zilla HQ X dev account (~5 min)

If Zilla HQ already has a dedicated X account for "platform / dev" use, skip to §2.

1. Open [x.com](https://x.com) in a fresh browser session.
2. Sign up with the Zilla HQ admin email (e.g. `dev@zilla.so`).
3. Pick a recognizable handle (`ZillaHQ`, `Zillaplatform`, etc.) — this account doesn't tweet, it only owns the dev app.
4. Verify the email.

This account becomes the **owner** of the X dev app. Every merchant brand account (`@Sitebeatapp`, `@Restayapp`, etc.) is a *separate* X account that authorizes this app via OAuth — none of them owns the app itself.

## 2. Create the X dev app (~10 min)

1. Open [developer.x.com](https://developer.x.com) and sign in as the Zilla HQ X account from §1.
2. Apply for the **Free tier** if you haven't already. X will ask:
   - **Use case**: Pick "Building tools for X users" or "Making a bot."
   - **Describe how you'll use the API** (this is the part that bites — see template below).
   - **Will you make data available to a government entity?** → No.
3. Free tier is auto-approved most of the time. If they kick it back, the rejection email will say what to fix.

**Use-case template** (paste, adapt for your portfolio):

> Zilla operates a portfolio of small-business SaaS products (e.g. Sitebeat, Restay). Each product has its own X brand account. We use the X API to (1) post product updates and tutorials from each brand account on a manual cadence (≤30 tweets per brand per month), and (2) read @mentions of each brand account so we can respond to user questions in a timely manner. We do not store, redistribute, or share X data with third parties. All data is used only for direct customer support and our own marketing.

Once approved:

1. Open the app in the dev portal.
2. Settings → **User authentication settings** → click **Set up**.
3. Configure:
   - **App permissions**: Read and Write
   - **Type of App**: Confidential client
   - **Callback URI / Redirect URL**: Add one entry per merchant. Format:
     ```
     https://sitebeat.tech/api/auth/x/callback
     https://restay.app/api/auth/x/callback
     https://<next-merchant>.example/api/auth/x/callback
     ```
     X allows multiple callbacks. Add new ones whenever a merchant launches.
   - **Website URL**: any URL you control, e.g. `https://zilla.so`
4. Save. The "Keys and tokens" tab will now show OAuth 2.0 credentials.

## 3. Pull the OAuth 2.0 credentials (~2 min)

1. Dev portal → your app → **Keys and tokens** tab.
2. Find the **OAuth 2.0 Client ID and Client Secret** section.
3. Click **Regenerate** if you don't already have them visible (X only shows secrets once).
4. Copy:
   - **Client ID** → `X_CLIENT_ID`
   - **Client Secret** → `X_CLIENT_SECRET`

These two are confidential. Treat them like database passwords.

## 4. Add credits (one-time, $20 recommended)

X charges per API call beyond the Free tier limits. Free tier covers most cases but occasional bursts (a viral mention, a busy launch day) can punch through.

1. Dev portal → **Billing** or **Account usage**.
2. Top up $10–$20 in credits — this prepays usage. Without credits, occasional API calls fail with `HTTP 402 CreditsDepleted` even on Free tier.

Sitebeat ran for ~30 days on $10. $20 is comfortable headroom for a 5-merchant portfolio.

## 5. Store credentials in the platform vault (~3 min)

Drop these into 1Password / Vault / Vercel team-level env (NOT per-merchant — these are shared across the entire portfolio):

```
X_CLIENT_ID=<from §3>
X_CLIENT_SECRET=<from §3>
```

Then propagate them to every merchant's Vercel project. Two options:

- **Manual** for now: copy/paste both env vars into each merchant's Vercel project. ~30s per merchant.
- **Automated** later: use the Zilla env-propagation script (the same one that handles `ZILLA_GSC_OAUTH_*`) to push these too. See `scripts/propagate-zilla-env.mjs` (TODO).

## 6. Per-merchant: authorize the brand account

For each merchant, follow [X.md §2](./X.md#2-operator-runbook--first-time-per-merchant-10-min):

1. Create the brand X account (e.g. `@Sitebeatapp`)
2. Set per-merchant `X_BRAND_NAME`, `X_BRAND_HANDLE`, `X_BRAND_ABOUT` in that merchant's Vercel env
3. Visit `/api/auth/x/start` while logged into the brand account → click Authorize → callback persists the refresh token
4. `/admin/x` should show "✓ Refresh token saved for @<handle>"

That's it. The merchant can now post + auto-reply autonomously.

---

## 7. Adding a new merchant later

When forking a new merchant from the template:

1. Add `https://<new-merchant>.example/api/auth/x/callback` to the X dev app's allowed Callback URIs (§2 step 3).
2. Set `X_CLIENT_ID` + `X_CLIENT_SECRET` in the new merchant's Vercel project (paste from vault).
3. Run X.md §2 (create brand account → set brand prompt → authorize).

No new dev app, no new approval flow.

---

## 8. Rotating credentials

- If `X_CLIENT_SECRET` is compromised: regenerate at the dev portal, replace the env var across every merchant. **Every merchant's refresh token survives** the secret rotation — they're tied to the client ID, not the secret.
- If a merchant's brand-account refresh token is revoked (operator clicked "Revoke" at x.com/settings/connected_apps): re-run X.md §2.3 from the brand account.

## 9. What if a merchant needs higher API limits?

Free tier is 500 writes / 100 reads per month, **shared across all merchants** (rate limits are at the dev-app level, not the per-account level).

If the portfolio outgrows Free:

- **Basic** ($200/mo): 3,000 writes + 50,000 reads. Sized for ~10 active merchants.
- **Pro** ($5,000/mo): 1M reads. Only relevant if you start ingesting external X data at scale.

The Free→Basic upgrade is a single billing change at the dev-app level. No code changes needed.
