# Parent Bootstrap Checklist (Day-0)

The one-time setup to stand up Zilla's parent infrastructure across Stripe, Meta, TikTok, Google, and X.

**Run this once.** After completion, the parent IDs go into config and never change. The whole flow takes 1–2 weeks elapsed (most of it waiting on verifications), 6–10 hours of active work.

**Pairs with:** `docs/01-ad-network-setup.md`, `docs/06-operations-playbook.md` § 1.

---

## Prerequisites (have these in hand before starting)

- [ ] Zilla legal entity formed (Delaware C-corp recommended)
- [ ] EIN (federal tax ID) issued
- [ ] Business address (a real one — virtual addresses get flagged at Meta and Stripe)
- [ ] Operating bank account opened (Mercury / Brex / Ramp recommended)
- [ ] Corporate card issued
- [ ] Domain `zilla.so` owned, with admin access to its DNS provider
- [ ] Founder + ops admin Google accounts (do NOT use personal accounts)
- [ ] Phone number for SMS verifications (a Google Voice or business line is fine)

---

## Stripe — Platform Account

- [ ] Create Stripe account at stripe.com using `business@zilla.so` (or equivalent business email — NOT personal)
- [ ] Complete corporate KYB: legal name, EIN, address, beneficial owners, business description
- [ ] Provide bank account for payouts (Zilla operating bank)
- [ ] Activate **Stripe Connect** in Dashboard → Connect → Get started
- [ ] Choose **Express** account type as the default for connected accounts
- [ ] Set platform branding (logo, primary color, support email) in Connect settings
- [ ] Note `STRIPE_SECRET_KEY` (live), `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — store in secrets manager
- [ ] Configure webhook endpoint: `https://api.zilla.so/webhooks/stripe`
- [ ] Subscribe to events: `account.updated`, `payment_intent.succeeded`, `charge.succeeded`, `charge.refunded`, `charge.dispute.*`, `account.application.deauthorized`, `payout.paid`
- [ ] Test webhook with Stripe CLI in dev environment

## Meta — Business Portfolio (formerly "Business Manager")

- [ ] Sign in to business.facebook.com with the Zilla admin Google account
- [ ] **Create Business Portfolio** — name `Zilla`, primary admin email `business@zilla.so` (or chosen)
- [ ] **Add domain `zilla.so`** under Business Settings → Domains
- [ ] Verify via DNS TXT record (preferred, more durable than meta-tag method):
  - [ ] Add TXT record at root: name `@`, value `facebook-domain-verification=<token>`
  - [ ] Confirm with `dig TXT zilla.so +short` before clicking Verify
- [ ] Domain verified status: green checkmark in Business Settings
- [ ] **Set up Aggregated Event Measurement (AEM)** for verified domain (8 conversion events allowed)
- [ ] Add a payment method: Zilla corporate card → Business Settings → Payments
- [ ] Add Zilla's billing address
- [ ] **Business Verification** — start when prompted (sometimes deferred until needed for a specific feature)
  - [ ] Provide D-U-N-S, EIN, articles, sometimes utility bill or lease
  - [ ] Wait 1–14 days for outcome
- [ ] **Create Zilla's own Page** ("Zilla" or "Zilla Inc.") — owned by the BP
- [ ] Note `META_BUSINESS_ID` (parent BP id)

## Meta — System User Token (Backend API Access)

- [ ] Business Settings → Users → System Users → Add → name `zilla-server` → role `Admin`
- [ ] Generate token with scopes: `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, `instagram_manage_insights`
- [ ] Set token to **Never Expire** if available, otherwise 60-day with auto-refresh job
- [ ] Encrypt + store in `network_api_tokens` (KMS-encrypted)
- [ ] Test: call `GET https://graph.facebook.com/v19.0/me?access_token=<token>` → should return business id

## Meta — Marketing API App

- [ ] Create app at developers.facebook.com → "Business" type
- [ ] Add Marketing API product
- [ ] Apply for **Standard Access** (advanced rate limits) — submit app review
- [ ] Note `META_APP_ID`, `META_APP_SECRET`

## TikTok — Business Center

- [ ] Sign up at business.tiktok.com with the Zilla admin Google account
- [ ] **Create Business Center** — name `Zilla`
- [ ] Complete **identity verification** (similar docs to Meta)
- [ ] Add Zilla's payment method (corp card)
- [ ] Apply for **Marketing API** access at developers.tiktok.com (for backend access)
- [ ] Generate long-lived advertiser-scoped access token via OAuth
- [ ] Encrypt + store in `network_api_tokens`
- [ ] Note `TIKTOK_BC_ID`

## Google — Manager Account (MCC) + Ads API

- [ ] Sign in to ads.google.com with Zilla admin Google account
- [ ] Create **Manager Account (MCC)** — name `Zilla`
- [ ] Complete corporate identity for the MCC
- [ ] Add Zilla's billing setup (corp card)
- [ ] Apply for **Google Ads API developer token** (developers.google.com/google-ads/api/docs/first-call/dev-token)
  - [ ] Apply ASAP — basic-level approval takes 1–7 days
  - [ ] Application requires MCC id, business description, intended use case
- [ ] Once approved, create OAuth2 client at console.cloud.google.com
- [ ] Generate refresh token via OAuth flow
- [ ] Encrypt + store in `network_api_tokens`
- [ ] Note `GOOGLE_MCC_CUSTOMER_ID`, `GOOGLE_DEVELOPER_TOKEN`

## X — Ads Account

- [ ] Sign up at ads.x.com with the Zilla X handle (or create handle: `@zilla` or `@zillaplatform`)
- [ ] Complete X Ads onboarding (lighter than other networks)
- [ ] Add Zilla payment method
- [ ] Subscribe to **X Ads API** (paid tier $100+/mo as of 2026)
- [ ] Apply for OAuth1.0a developer access
- [ ] Generate consumer key + secret + access token + access secret
- [ ] Encrypt + store in `network_api_tokens`
- [ ] Note `X_ADS_ACCOUNT_ID`

## Engineering / Infra

- [ ] Provision Postgres (RDS / Neon / Supabase)
- [ ] Run `schema/postgres-init.sql`
- [ ] Set up KMS (AWS KMS or GCP KMS) — encrypt all tokens at rest
- [ ] Stand up middleware service (zilla-v2 backend) with env vars:
  - [ ] `DATABASE_URL`
  - [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - [ ] `KMS_KEY_ID`
  - [ ] `META_APP_ID`, `META_APP_SECRET`, `META_BUSINESS_ID`
  - [ ] `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`, `TIKTOK_BC_ID`
  - [ ] `GOOGLE_DEVELOPER_TOKEN`, `GOOGLE_MCC_CUSTOMER_ID`
  - [ ] `X_ADS_ACCOUNT_ID`, `X_OAUTH_*`
- [ ] Deploy Stripe webhook handler — `/webhooks/stripe`
- [ ] Deploy ad-network polling jobs (cron schedule per `docs/03-engineering-spec.md` § 4)
- [ ] Deploy `balance_safety_check` cron (every 15 min)
- [ ] Deploy `balance_drift_check` cron (nightly)
- [ ] Hook up error tracking (Sentry) and metrics (Datadog or Grafana)
- [ ] Create runbook entry for on-call (PagerDuty)

## End-to-End Sandbox Test

- [ ] Create a **test sub-company** in dev env with Stripe test mode
- [ ] Run through onboarding: Stripe Express KYC → ad-account provisioning → ad-credit top-up
- [ ] Launch a $5 test campaign on Meta and verify:
  - [ ] Campaign appears in `ad_campaigns` table
  - [ ] Spend poller picks it up within 4h
  - [ ] `ad_credit_transactions` row written with `status=pending`
  - [ ] Balance decremented correctly
  - [ ] Eventually transitions to `status=settled` after Meta invoices
- [ ] Send a $10 test charge through Stripe Connect with `application_fee_amount=200`
  - [ ] `revenue_transactions` row written with correct gross/fee/application_fee/net
  - [ ] Webhook idempotency holds (replay event → no duplicate row)
- [ ] Trigger balance-floor scenario (set test balance to $51, run a $5/day campaign)
  - [ ] Confirm auto-pause within 15 min
- [ ] Trigger drift scenario (manually adjust `ad_credit_balances`)
  - [ ] Confirm nightly drift alarm fires

## Final Sign-Off

- [ ] Engineering: yes, infra is up and tested
- [ ] Ops/Legal: yes, ToS + privacy policy live at zilla.so/terms and /privacy
- [ ] Compliance: yes, MTL posture documented (`docs/05-compliance.md`); below all trigger thresholds
- [ ] Finance: yes, treasury account configured, drift alerts wired into accounting
- [ ] Founder: yes, ready to onboard sub-company #1

After sign-off: proceed to `checklists/new-sub-company.md` for each sub-company onboarding.
