# Zilla HQ — Meta Ads parent setup

> Run this **once** for the entire Zilla portfolio. After it's done, every new sub-company spun up on Zilla can run paid ads on Meta with zero manual Meta-account work — the platform mints a Page, IG, ad account, and Pixel under the parent BP and wires them into the merchant's Vercel env automatically.
>
> Estimated time: **~2 hours, one-time.** As of **2026-05-06, this is COMPLETE.** The procedure below stays here as the canonical record + recovery runbook (e.g. for a clean second entity, an EU twin, or DR rebuild).

The Day-0 outcome is one Zilla-owned **Business Portfolio (BP)** at Meta with one **System User** (`Platform`) holding a never-expiring access token. That token is what every sub-company's autonomous AI agent uses to launch and manage Meta campaigns, with the parent's corporate card paying Meta directly. Founders of sub-companies never enter a card with Meta and never see a Meta invoice — they only see their Zilla ad-credit balance and the campaigns the agent launched on their behalf.

This is the same architecture Polsia runs. Full deep-dive in [`architecture/docs/01a-meta-sub-company-replication.md`](./architecture/docs/01a-meta-sub-company-replication.md).

---

## 0. What's already done (skip if you're not doing a fresh rebuild)

| Asset | Status | Value |
|---|---|---|
| Parent Business Portfolio (`zilla.so`) | ✅ verified | `ZILLA_PARENT_BUSINESS_ID=1952475115474490` |
| Domain verification (DNS TXT) | ✅ verified | covers all `*.zilla.so` |
| Business Verification | ⏳ submitted, pending Meta review | — |
| Corporate card on BP | ✅ on file | Brex / Amex |
| Meta App | ✅ Live mode | `ZILLA_META_APP_ID=1281372737395331` |
| System User (`Platform`) | ✅ Admin + App role | `ZILLA_SYSTEM_USER_ID=61589373840437` |
| Never-expiring token (9 scopes) | ✅ in Vercel + 1Password | `ZILLA_SYSTEM_USER_TOKEN` (secret — never in this repo) |
| `.env.example` | ✅ updated | parent IDs as real values; token blank with `vercel env pull` instructions |

If everything in the table is ✅, **you don't need to do §1–6 below.** Skip to **§7 (How a new engineer gets up and running)** and **§8 (How a new sub-company gets minted)**.

If you're doing a clean rebuild, work through §1–6 in order. **Do not skip steps** — Meta's UI gates each step on the previous one.

---

## 1. Create the Business Portfolio (~10 min)

> Prerequisite: a dedicated `business@zilla.so` Google Workspace account and a dedicated admin Facebook profile (NOT a personal one). You'll also need Zilla's EIN, business address documents, and the Zilla corporate card.

1. Open [business.facebook.com/overview](https://business.facebook.com/overview) signed in as the dedicated admin profile.
2. Click **Create Business Portfolio**.
3. Name: `Zilla`. Legal entity name: whatever the LLC actually is. Address: Zilla HQ. Phone: a business line. Website: `https://zilla.so`.
4. Save. The URL of the BP overview page now contains the BP ID — capture it as **`ZILLA_PARENT_BUSINESS_ID`**.
5. **Add 2 admins with 2FA enforced.** A single-admin BP is a single point of failure. Use authenticator apps, not SMS. Both admins need to be the dedicated Facebook profiles tied to `business@zilla.so` aliases — never personal profiles.

## 2. Verify the domain (~5 min + DNS propagation)

This step is what gives the BP authority over `zilla.so` for ad delivery, AEM, and CAPI.

1. Business Settings → **Brand Safety** → **Domains** → **Add** → enter `zilla.so`.
2. Choose **DNS verification** (preferred) or Meta tag. DNS is preferred because it covers all subdomains automatically.
3. Meta gives you a TXT record like `facebook-domain-verification=<value>`.
4. In Vercel (or your DNS provider), add the TXT record at the root host (`@`).
5. Wait 5–10 min for DNS to propagate. Click **Verify** in Meta.
6. Verify all `*.zilla.so` subdomains are now covered by the parent verification.

## 3. Add the corporate card (~3 min)

This is the funding source every child ad account inherits. **Founders of sub-companies will NOT enter their own cards** — Meta charges this card, and the platform reconciles spend against the founder's Zilla balance.

1. Business Settings → **Payment Methods** → **Add Payment Method**.
2. Enter the Brex or Amex corporate card.
3. Set as primary.

> If this card fails or hits a limit, every sub-company's ads pause simultaneously. Keep a backup card on the BP and have a credit headroom alarm.

## 4. Create the Meta App (~10 min)

The App is what System Users authenticate against. Without one, you can't generate a long-lived token in §6.

1. Open [developers.facebook.com/apps](https://developers.facebook.com/apps).
2. **Create App** → type **Business** → next.
3. App name: `Zilla Ads Platform` (display name, can be anything). Contact email: `business@zilla.so`.
4. **Connect Business Portfolio** → select the Zilla BP from §1.
5. Submit. Capture the App ID as **`ZILLA_META_APP_ID`**.
6. After creation, switch the App from **Development** to **Live mode** (App Settings → top-right toggle).
7. Add **Marketing API** as a product (App Dashboard → Products → Add → Marketing API).
8. Confirm the App is attached to the BP at Business Settings → **Apps** → it should show your App. If not, click **Add** → **Existing app** → select.

## 5. Create the System User (~5 min)

1. Business Settings → **Users** → **System Users** → **Add**.
2. Name: `Platform` (single word, lowercase or capitalized — your choice, but keep it simple).
   - **Do not** name it "Zilla Ads Agent", "Zilla Platform", "Bot", "Manager", "Admin", or anything multi-word containing reserved tokens. Meta rejects them with a generic "Choose another name" error.
3. Role: **Admin**.
4. Save. Capture the System User ID as **`ZILLA_SYSTEM_USER_ID`**.

### 5a. Assign the System User an App role

This is the gotcha that traps everyone. Even though the App is attached to the BP, the System User needs an **explicit App role** to mint tokens. Without it, the Generate Token button hits `No permissions available — Assign an app role to the system user or select another app to continue.`

1. Business Settings → **Users** → **System Users** → click `Platform`.
2. **Add Assets** → **Apps** → select the Zilla App from §4.
3. Toggle **Develop app** → **Save**.

## 6. Generate the never-expiring token (~5 min)

1. Business Settings → **Users** → **System Users** → click `Platform`.
2. **Generate New Token** (top-right).
3. Select the Zilla App from §4.
4. Expiration: **Never**.

   > **Why Never and not 60-day:** This is a backend production credential. There's no human to refresh it. A 60-day token means a hard outage every 2 months. Meta supports never-expiring System User tokens specifically for verified-BP backends. Rotation is operational (do it on a schedule), not protocol (don't let Meta force it).

5. Tick exactly these 9 scopes:
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_manage_metadata`
   - `pages_show_list`
   - `instagram_basic`
   - `instagram_manage_insights`
6. Click **Generate Token**. Meta shows the token **once**. Copy it immediately.
7. Store it in **two places only**:
   - Vercel project env (Production + Preview + Development scopes) as `ZILLA_SYSTEM_USER_TOKEN`.
   - 1Password "Zilla Platform" vault as a backup.
8. **Never** paste the token in Slack, GitHub, the repo, a doc, or chat. If you accidentally do — go straight back to step 6.1 and click **Revoke** on the existing token, then regenerate. It takes 30 seconds.

### 6a. Verify the token works

```bash
curl "https://graph.facebook.com/v19.0/me?access_token=$ZILLA_SYSTEM_USER_TOKEN"
# → { "name": "Platform", "id": "61589373840437" }

curl "https://graph.facebook.com/v19.0/$ZILLA_PARENT_BUSINESS_ID?fields=name,verification_status&access_token=$ZILLA_SYSTEM_USER_TOKEN"
# → { "name": "Zilla", "verification_status": "verified", "id": "1952475115474490" }
```

If either call returns an `OAuthException` with code 200 ("Permissions error") — the App role from §5a wasn't assigned. Go fix that.

## 7. How a new engineer gets up and running

Once §0's table is all ✅, onboarding a new engineer to work on Zilla's Meta integration is two commands:

```bash
git clone git@github.com:Zilla-HQ/merchant-template.git
cd merchant-template
npm install

# One-time per machine: link this folder to the Vercel project
npx vercel link

# Pull every secret (including ZILLA_SYSTEM_USER_TOKEN) into a gitignored .env.local
npx vercel env pull .env.local

npm run dev
```

That's it. No Slacking secrets around. No manual `.env.example` edits. The committed `.env.example` has every public ID populated with real values — the only thing `vercel env pull` adds is the secret token (and any per-merchant secrets like Stripe keys).

If a new engineer doesn't have Vercel access, add them to the `Zilla-HQ` Vercel team with the role "Member". They'll inherit access to the merchant-template project's env vars automatically.

## 8. How a new sub-company gets minted (the autonomous flow)

When a founder signs up at `zilla.so` and pays their first $99/mo subscription + tops up an ad-credit balance, the platform spins up a Meta footprint for them with **zero manual Meta UI work**. The orchestrator is `inngest/functions/sub-company-onboard.ts`, which calls `lib/meta-platform.ts` wrappers in this order:

| Step | What it does | API call |
|---|---|---|
| 1 | Create the brand-named Facebook Page | `POST /<ZILLA_PARENT_BUSINESS_ID>/owned_pages` |
| 2 | Create the child ad account (currency + timezone locked at creation) | `POST /<ZILLA_PARENT_BUSINESS_ID>/owned_ad_accounts` |
| 3 | Inherit parent corporate card as funding source | (automatic — no API call needed; child accounts under a verified BP inherit) |
| 4 | Create the per-merchant Pixel | `POST /<ZILLA_PARENT_BUSINESS_ID>/owned_pixels` |
| 5 | Connect Pixel ↔ ad account | `POST /<pixel_id>/shared_accounts` |
| 6 | Assign `Platform` System User to all 4 child assets (Page, IG, ad account, Pixel) | `POST /<asset_id>/assigned_users` with tasks `MANAGE`, `ADVERTISE`, `ANALYZE` |
| 7 | Set the daily spend cap (default $50/day for new accounts) | `POST /act_<account_id>` with `spend_cap` |
| 8 | Verify the merchant's domain (if it's apex, not `*.zilla.so`) | `POST /<ZILLA_PARENT_BUSINESS_ID>/verified_domains` (otherwise inherits from `zilla.so`) |
| 9 | Push the new IDs (`META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CONVERSIONS_API_TOKEN`) into the merchant's Vercel project env | Vercel REST API |
| 10 | Trigger the merchant's first deploy so the new env vars take effect | Vercel REST API |

When the founder lands on their Zilla dashboard, every Meta asset is provisioned. The first agent campaign can launch within minutes.

The full payload-by-payload spec lives in [`architecture/docs/01a-meta-sub-company-replication.md` § 5](./architecture/docs/01a-meta-sub-company-replication.md). Read that before touching `lib/meta-platform.ts` so you understand which calls are idempotent, which need retry-with-backoff (Meta's `429`s are aggressive), and which leave orphan assets if they fail mid-flow.

## 9. What an operator sees (the founder's UX)

A sub-company founder never touches Meta. Their experience:

1. Sign up at `zilla.so`, pick a vertical (or upload a brand brief).
2. Pay $99/mo → top up an ad-credit balance ($500 default).
3. Wait ~3 minutes while the platform mints their assets.
4. Land on their Zilla dashboard. They can see:
   - Their brand-named Page (preview link).
   - Their ad-credit balance ($500.00 / topped up 2026-05-06).
   - The first agent-launched campaign ("Lead-CAC test, $20/day").
5. They can pause the campaign, top up more credits, or watch it run. Everything else is the agent's job.

If the agent's auto-launched campaigns hit a CAC ceiling, the agent pauses them and surfaces the issue in the dashboard. If the ad-credit balance drops below the floor, the agent stops launching new campaigns and emails the founder to top up.

### 9a. The operator-facing prompt (the live conversational entry point)

When a sub-co founder (or the engineer onboarding them) wants Claude to walk them through the mint by hand — for example, the first few sub-cos before the autonomous flow in §8 is fully wired, or a recovery scenario where one child asset got nuked — they don't read this doc top-to-bottom. They paste [`SUB_CO_META_ONBOARDING_PROMPT.md`](./SUB_CO_META_ONBOARDING_PROMPT.md) into Claude and follow the conversational walkthrough.

That prompt:

- Hardcodes the parent BP context (`ZILLA_PARENT_BUSINESS_ID=1952475115474490`, App=`1281372737395331`, System User=`61589373840437`) so Claude won't try to spin up a new BP, ask for a card, or treat the operator as an external business.
- Asks one diagnostic question at a time (brand name, domain, target country, currency, vertical, founder Vercel access, BP admin assignment) before touching anything.
- Steps through child-asset creation **under the parent BP** → Vercel env wiring → Pixel/CAPI verification → AEM ranking → first campaign launch via `npm run meta:create-ads`.
- Has explicit `<rules>` and `<edge_cases>` blocking architectural drift (no new BP, no new card, never paste tokens).
- Cites [`META_ADS.md`](./META_ADS.md) at the campaign-launch step for the full playbook (campaign structure, scaler logic, fatigue checks).

Use it for: first-N sub-co manual mints, recovery (re-creating a child asset that got deleted in Meta UI), or training a new operator on the mental model. Do **not** use it for the production autonomous path — that's `lib/meta-platform.ts` + `inngest/functions/sub-company-onboard.ts` (§8).

## 10. Troubleshooting

**`OAuthException` code 100 — Object does not exist or you don't have permission.**
The `Platform` System User isn't assigned to the asset you're calling. Check Business Settings → Users → System Users → `Platform` → Assigned Assets and add it.

**`OAuthException` code 200 — Permissions error.**
The token is missing a scope. The 9 scopes in §6.5 are a strict superset — re-mint the token if anything's missing.

**`OAuthException` code 17 — User request limit reached.**
Meta is rate-limiting the App or the System User. Check App Dashboard → Marketing API → Rate Limits. The fix is usually backoff + batching, not a higher tier — the Marketing API tier auto-bumps with spend volume.

**Spend cap on a new ad account is stuck at $50/day.**
This is by design for the first 3–7 days. Don't try to override — Meta flags the account if you 10x the budget on day 1. The platform's budget scaler ramps `+20% every 2–3 days` for exactly this reason.

**Token works for `/me` but fails on `/<bp_id>/owned_ad_accounts`.**
The System User has admin role on the BP but no asset-level role on the children. The platform onboarding flow assigns the System User to every child asset it creates (§8 step 6) — if you minted a child by hand in the UI, you have to do that assignment by hand too.

**Domain verification on a sub-co's apex (not `*.zilla.so`) is taking forever.**
Meta sometimes takes 24–48h to confirm DNS even after propagation. The merchant can run ads on the `*.zilla.so` subdomain in the meantime; AEM allocations transfer when the apex finally verifies.

---

## See also

- [`SUB_CO_META_ONBOARDING_PROMPT.md`](./SUB_CO_META_ONBOARDING_PROMPT.md) — the paste-into-Claude prompt for live operator walkthroughs (manual mint of a sub-co's child Meta assets under the parent BP). The conversational equivalent of this doc + §8 + META_ADS.md, hardcoded to the Zilla parent context.
- [`META_ADS.md`](./META_ADS.md) — the per-merchant Meta runbook (campaign structure, scaler logic, fatigue checks). Aimed at the merchant-template fork audience.
- [`architecture/docs/01a-meta-sub-company-replication.md`](./architecture/docs/01a-meta-sub-company-replication.md) — the full deep-dive spec for the parent/child architecture, schema touchpoints, and onboarding orchestrator.
- [`architecture/docs/01-ad-network-setup.md`](./architecture/docs/01-ad-network-setup.md) — the BD/architecture context for why this Polsia model wins over per-merchant BPs.
- [`SETUP.md`](./SETUP.md) — what a fresh engineer does to bring a merchant-template fork up locally, including `vercel env pull`.
- [`ZILLA_HQ_SETUP.md`](./ZILLA_HQ_SETUP.md) — the SEO equivalent of this doc (parent-level GSC + Bing setup that every subdomain merchant inherits).
