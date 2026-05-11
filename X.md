# X (Twitter) — full runbook

> **One-liner:** every Zilla merchant can post tweets + threads from its own brand X account, and Claude auto-replies to @mentions every 30 minutes — all powered by **one Zilla HQ X dev app** shared across the portfolio (same pattern as Meta Ads + GSC).
>
> Distilled from setting up the first merchant (Sitebeat → @Sitebeatapp) end-to-end in May 2026. Following this top-to-bottom should let an engineer ship and an operator wire up a new merchant brand account in **~15 minutes**.

This is the canonical X integration for any Zilla merchant. The template ships with all code in place — `lib/x-oauth.ts`, `lib/x-poster.ts`, `lib/x-mentions-handler.ts`, `inngest/functions/x-mentions-poll.ts`, `app/api/auth/x/*`, `app/admin/x`. This doc is **what each role does to wire it up against X**.

Two readers:

- **Engineers** (Zilla platform team or merchant fork team): §1, §3, §6 — the architecture, code paths, and HQ-level decisions
- **Operators** (the human running the merchant): §2, §4, §5 — the click-through runbook in X dev portal + brand-account auth flow

---

## 0. When NOT to spend time on this

If the merchant has **no plausible X audience** (B2B-only, internal tooling, very local non-tech business) — skip. X auto-reply works best when:

- The brand could plausibly get @mentions (consumer SaaS, indie tool, public-facing product)
- The merchant has at least one URL strangers might tweet about (homepage, landing page, free tool)

If neither holds, the auto-reply cron will just sit at 0 mentions/run forever — harmless but pointless.

---

## ⚠️ The rotating-refresh-token gotcha — read this before touching X auth

X's OAuth 2.0 PKCE flow uses **rotating refresh tokens**. Every successful POST to `https://api.twitter.com/2/oauth2/token` (with `grant_type=refresh_token`) returns a new refresh token **and invalidates the old one server-side**.

The production code path in `lib/x-poster.ts:getAccessToken()` handles this correctly:

```ts
async function getAccessToken(): Promise<string> {
  const refresh = await loadRefreshToken();
  const result = await refreshAccessToken(refresh);
  if (result.refreshToken !== refresh) {
    await persistRefreshToken(result.refreshToken);  // ← critical
  }
  return result.accessToken;
}
```

**Never call `/oauth2/token` from a throwaway / diagnostic script** unless you also persist the rotated token back to `admin_settings.x_refresh_token` immediately. If you skip the persist step, the production refresh token in the DB is now dead — every subsequent run errors with:

```
HTTP 400 invalid_request — "Value passed for the token was invalid."
```

The only fix is to re-authorize via `/api/auth/x/start` (or restore the rotated token from your script's stdout if you still have it). This happened on 2026-05-07 to Sitebeat's @Sitebeatapp integration — recovered by reading the rotated token out of script stdout and writing it to the DB.

**To diagnose X auth**: read `admin_settings.x_refresh_token` and confirm it's non-null. That's enough — **don't validate it by actually refreshing**. To force a real round-trip, call the production code path (`await postTweet(...)` from a server action) so persistence happens.

This pattern applies to any rotating-refresh-token OAuth provider this template integrates in the future. Assume rotation by default until docs say otherwise.

---

## 1. Architecture (engineers, ~5 min)

The pattern matches **Meta Ads** and **GSC** in this repo: one HQ-level credential, per-merchant brand-account auth, autonomous from there.

```
┌─────────────────────────────────────────────────────────┐
│ Zilla HQ                                                │
│   X dev app (one)                                       │
│   ├── X_CLIENT_ID                                       │
│   └── X_CLIENT_SECRET                                   │
│   Shared across every merchant via Vercel team env vars.│
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐     ┌──────────┐
   │ Sitebeat │    │ Restay   │     │ <next>   │
   │@Sitebeat │    │ @Restay  │     │ @brand   │
   │  app     │    │   app    │     │          │
   ├──────────┤    ├──────────┤     ├──────────┤
   │ refresh  │    │ refresh  │     │ refresh  │
   │ token    │    │ token    │     │ token    │
   │ (OAuth2  │    │ (OAuth2  │     │ (OAuth2  │
   │  PKCE)   │    │  PKCE)   │     │  PKCE)   │
   └──────────┘    └──────────┘     └──────────┘
   admin_settings  admin_settings   admin_settings
   .x_refresh_token (per-merchant DB)
```

**Why one HQ X app + per-merchant refresh tokens?**

X is the same as Google in this regard: a **single OAuth client** can be authorized by multiple end-user accounts, each producing a separate refresh token. The HQ creds are inert without a refresh token — they're just a manifest saying "this app is allowed to ask users for permission." Each merchant gets its own refresh token tied to its own brand account, stored in *its own* DB.

Compare to the alternative (one X app per merchant): you'd have to file a new dev app for every fork, fill out every "describe your use case" form again, wait for approval, manage N sets of credentials. Pure drag.

**Code map:**

| File | Role |
|---|---|
| `lib/x-oauth.ts` | PKCE flow — `buildAuthorizeUrl()`, `exchangeCodeForTokens()`, `refreshAccessToken()` |
| `lib/x-poster.ts` | Send tweets/threads + fetch mentions; loads refresh token from `admin_settings.x_refresh_token`, mints fresh access token per call |
| `lib/x-mentions-handler.ts` | Claude-driven evaluator + reply-writer; one big system prompt parameterized by `X_BRAND_*` env vars |
| `inngest/functions/x-mentions-poll.ts` | Cron `*/30 * * * *` + `x-mentions/poll` event trigger |
| `app/api/auth/x/start` + `/callback` | OAuth round-trip; persists refresh token to `admin_settings` |
| `app/admin/x/page.tsx` | Operator UI: env-var checklist, "Authorize" button, tweet composer, recent-mentions log |
| `app/api/admin/post-tweet` | Admin-gated send endpoint backing the composer |

**Schema:**

| Column | Where | Purpose |
|---|---|---|
| `admin_settings.x_refresh_token` | per-merchant | OAuth 2.0 refresh token for the brand account |
| `admin_settings.x_user_id` | per-merchant | Cached `/2/users/me.id`; lets us call `/2/users/{id}/mentions` without an extra round-trip |
| `admin_settings.x_username` | per-merchant | Cached display @-handle |
| `admin_settings.x_mentions_since_id` | per-merchant | Watermark — mentions are pulled with `since_id=<this>` so we never re-process |
| `x_mentions` | per-merchant | Audit log of every mention seen + decision (`replied` / `skipped` / `errored`) + reasoning |

---

## 2. Operator runbook — first-time per merchant (~10 min)

Pre-condition: §3 + §4 are done at the HQ level. Then per merchant:

### 2.1 Create the brand X account (if it doesn't exist)

1. Open [x.com](https://x.com) in a fresh browser tab. Sign out of any personal account.
2. Sign up with the merchant's brand handle (e.g. `Sitebeatapp`, `Restayapp`).
3. Use a brand inbox (e.g. `hello@sitebeat.tech`) — operator notifications go here.
4. Complete the bio + profile picture + banner. Real account, not a stub.

### 2.2 Set per-merchant brand prompt

In the merchant's Vercel project env vars:

```
X_BRAND_NAME=Sitebeat
X_BRAND_HANDLE=Sitebeatapp
X_BRAND_ABOUT=<<long multi-line — see template below>>
```

`X_BRAND_ABOUT` is pasted directly into the auto-reply system prompt. Cover:

- 1-paragraph description of the product
- Bulleted list of "REPLY when ..." conditions
- Bulleted list of "DO NOT reply when ..." conditions
- Reply-formatting rules (length, tone, link to drop, promo code if any)

Look at Sitebeat's `lib/x-mentions-handler.ts` `SYSTEM_PROMPT` constant for a working example.

If you skip these, the handler still runs but uses a generic SMB fallback that won't drop the right links.

### 2.3 Authorize the brand account

1. In the same browser tab where you're logged into the brand account, navigate to: `https://<merchant-app-url>/api/auth/x/start`
2. X's OAuth screen appears. Click **Authorize app**.
3. X redirects back to `/api/auth/x/callback`. If you see "✓ X authorization complete", the refresh token is saved.
4. Visit `/admin/x` to confirm `Refresh token saved for @<handle>` is shown.

If you see an error page, check the message. Most common failures:

| Symptom | Fix |
|---|---|
| "X_CLIENT_ID / X_CLIENT_SECRET not set" | HQ creds aren't propagated yet. Check Vercel env vars + redeploy. |
| "State mismatch" | Stale browser tab — restart from `/api/auth/x/start`. |
| "Auth cookies missing" | Cookies were blocked. Disable strict tracking protection for the merchant domain and retry. |

### 2.4 Send a test tweet

1. `/admin/x` → **Compose** → type something innocuous.
2. Click **Post tweet**.
3. Confirm the tweet appears at `x.com/<handle>/status/<id>`.

### 2.5 Wait for auto-reply

- Cron fires every 30 min on `*/30 * * * *`. Or trigger manually from Inngest with the `x-mentions/poll` event.
- First run pulls the last ~20 mentions. Subsequent runs use the watermark.
- Each run, Claude evaluates each mention and decides reply/skip — see `/admin/x` → "Recent @mentions" for the audit trail.
- Hard cap: 5 replies per run (override via `X_MENTIONS_MAX_REPLIES_PER_RUN`).

---

## 3. HQ-level setup (engineer, one-time, ~30 min)

This is the equivalent of `ZILLA_HQ_SETUP.md` for SEO. **Do this once for the entire portfolio.**

See `ZILLA_HQ_SETUP_X.md` for the click-through runbook covering:

1. Create the X dev app at developer.x.com under the Zilla HQ X account
2. Apply for **Free** tier (sufficient for ≤500 tweets/month + mentions read) — or upgrade if you expect more volume
3. Configure OAuth 2.0 with PKCE: enable `tweet.read`, `tweet.write`, `users.read`, `offline.access`
4. Set Callback URI(s) to every merchant's `/api/auth/x/callback`
5. Copy `X_CLIENT_ID` + `X_CLIENT_SECRET` into Vercel team-level env vars

After §3 is done once, every subsequent merchant just runs §2.

---

## 4. Costs (~ what to budget)

Per merchant, per month, assuming a moderately mentioned brand account:

- **X Free tier**: $0/month — gets you 500 tweet writes/month + 100 mention reads/month
- **X Basic tier**: $200/month — 3,000 writes + 50,000 reads. Worth it if a merchant goes viral.
- **Anthropic (Claude Haiku)**: ~$0.001 per mention evaluated. 10/day = ~$0.30/month. Negligible.

**Watch for:** the X tier is at the *dev app* level (one app, not per merchant). All merchants share the rate limit. If you push past 500 writes/month across the portfolio, upgrade once.

---

## 5. Operator-visible behavior

- Operator never has to log into X to reply to mentions — Claude does it
- Every decision is logged to `x_mentions` with `decision` + `reasoning`
- Operator can override by tweeting from the brand account directly (X auth is shared) — those tweets get logged as "own tweet — not auto-replying to self" on the next poll, never replied-to

---

## 6. When auto-reply goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Mentions logged as `errored` with "HTTP 401" | Refresh token revoked (operator clicked "Revoke access" in X settings) | Re-run §2.3 |
| Mentions logged as `errored` with "CreditsDepleted" | X dev app credits hit zero (paid Basic tier on monthly cap, or Free tier exhausted) | Add credits or upgrade |
| Reply text feels off-brand | `X_BRAND_ABOUT` is too vague | Rewrite with concrete examples + tone instructions |
| Same mention replied to twice | `x_mentions_since_id` watermark wasn't advanced (rare; only if a previous run threw before the final UPDATE) | Manually set `admin_settings.x_mentions_since_id` to the highest seen `mention_tweet_id` |
| 0 mentions ever | Account is new + has no followers; the API only returns mentions visible to the authenticated user | Tweet a few times, get followed by anyone, mentions start flowing |
| Replied tweet returns 403 from X | X's duplicate-content filter caught a near-identical reply | Rewrite the system prompt to enforce more variation |

---

## 7. Disabling

To kill the auto-reply globally for a merchant:

```sql
UPDATE relist.admin_settings SET paused = true WHERE id = 1;
```

The cron checks `settings.paused` first and bails early. To stop posting only (leave mentions polling):

```sql
UPDATE relist.admin_settings SET x_refresh_token = NULL WHERE id = 1;
```

Once cleared, every send + mention-fetch throws and the cron re-skips. Restore by re-running §2.3.
