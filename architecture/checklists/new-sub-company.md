# New Sub-Company Onboarding Checklist

Run this for every sub-company that signs up on Zilla. Most steps are automated by the middleware; this checklist exists for manual ops review and as a reference for what's actually happening in the background.

**Pairs with:** `docs/03-engineering-spec.md` (automation logic), `docs/04-product-and-ux.md` (founder-facing flow), `docs/06-operations-playbook.md` § 2.

**Target:** founder-completable in <15 minutes; first campaign launchable same day.

---

## Step 1 — Sub-Company Registration (Zilla)

Founder fills the four-field form:

- [ ] Sub-company name
- [ ] One-sentence business description
- [ ] Target customer
- [ ] Pricing model (subscription / one-time / freemium)

Middleware auto-creates:

- [ ] `sub_companies` row with `status='created'`, generated `slug`, `daily_spend_cap_cents=50000` (default $500/day)
- [ ] `ad_credit_balances` row with `balance_cents=0`
- [ ] Subdomain provisioned: `<slug>.zilla.so` (or independent domain registered later)

Ops check:

- [ ] Run business description through fraud / policy classifier
- [ ] If high-risk category flagged → human review queue, block ad provisioning until cleared
- [ ] If hard-blocked category (illegal / sanctioned) → terminate at onboarding with explanation

## Step 2 — Stripe Connect Express (Founder)

Middleware:

- [ ] Calls `POST /v1/accounts` with `type=express`, country, founder email, capabilities, metadata
- [ ] Stores returned `acct_xxx` to `sub_companies.stripe_connect_account_id`
- [ ] Creates Account Link, redirects founder

Founder completes Stripe-hosted onboarding:

- [ ] Legal name, DOB, address
- [ ] Business type (individual or company + EIN)
- [ ] Bank account for payouts
- [ ] Identity verification (ID document upload)

Stripe `account.updated` webhook:

- [ ] Middleware updates `sub_companies.status` to `onboarding` until KYC complete
- [ ] When `charges_enabled=true` and `payouts_enabled=true` → `status='active'`
- [ ] If `requirements.disabled_reason` present → surface to founder as banner with action

## Step 3 — Provision Ad-Network Children (automated)

For each network (Meta, TikTok, Google, X), middleware creates the child assets under Zilla's parent BP/BC/MCC.

### Meta

- [ ] Create child Ad Account under parent BP (Marketing API: `POST /act_<parent_id>/adaccounts`)
- [ ] Create Facebook Page for sub-company (or claim existing if founder owns one)
- [ ] Create Meta Pixel + Conversions API setup, scoped to sub-company domain (or `<slug>.zilla.so`)
- [ ] Create Instagram Business Account, link to Page
- [ ] Apply Aggregated Event Measurement events to sub-company's domain (8 max under Zilla's verified domain)
- [ ] Write `ad_network_accounts` row: `network='meta'`, `external_account_id=<ad_account_id>`, `external_pixel_id`, `fb_page_id`, `ig_account_id`, `status='active'`

### TikTok

- [ ] Create child Advertiser under parent Business Center
- [ ] Create TikTok Pixel scoped to sub-company domain
- [ ] (If founder has TikTok organic handle) link organic TikTok account to advertiser for Spark Ads
- [ ] Write `ad_network_accounts` row: `network='tiktok'`, `external_account_id=<advertiser_id>`, `external_pixel_id`, `status='active'`

### Google

- [ ] Create child Customer (sub-account) under parent MCC
- [ ] Create GA4 property, link to Google Ads
- [ ] Install Google Tag on sub-company's domain
- [ ] Write `ad_network_accounts` row: `network='google'`, `external_account_id=<customer_id>`, `ga4_property_id`, `status='active'`

### X

- [ ] Create child X Ads account (often manual — X automation is limited)
- [ ] Install X Pixel on sub-company's domain
- [ ] Write `ad_network_accounts` row: `network='x'`, `external_account_id=<x_account_id>`, `status='active'`

If any step fails: surface to founder as "Network X is still provisioning — usually 24h" and put a row in ops review queue. Do NOT block other networks on a single failure.

## Step 4 — First Ad-Credit Top-Up (Founder)

Founder picks an amount and pays:

- [ ] Middleware creates Stripe `payment_intent` with `metadata.zilla_purpose='ad_credit_topup'`
- [ ] Charged on Zilla platform account (NOT on sub-company connected account)
- [ ] Webhook `payment_intent.succeeded` writes `ad_credit_transactions` row: `type='topup'`, `status='settled'`, `source_kind='stripe'`
- [ ] `ad_credit_balances.balance_cents` incremented

## Step 5 — Sub-Company Activation

Middleware confirms all of:

- [ ] `sub_companies.status='active'` (Stripe KYC complete)
- [ ] At least one active `ad_network_accounts` row (any network)
- [ ] `ad_credit_balances.balance_cents > 0`
- [ ] Fraud review (if any) cleared

When all true:

- [ ] Mark sub-company eligible for agent operations
- [ ] Send "Welcome — your sub-company is live" email
- [ ] Surface dashboard in fully-active state (no banners)
- [ ] AI agent service notified, scoped to this sub-company

## Step 6 — First Campaign (AI Agent)

Agent generates first campaign, calls `Zilla Middleware.launchCampaign`:

- [ ] Middleware: balance ≥ floor ($50)? ✓
- [ ] Middleware: per-sub-co daily cap allows it? ✓
- [ ] Middleware: agent rate limit allows it? ✓
- [ ] Middleware: creative passes pre-launch policy classifier? ✓
- [ ] Network API call (Meta Marketing API or equivalent)
- [ ] Write `ad_campaigns` row with `created_by='agent'`
- [ ] Agent feed updated in dashboard

If any check fails: agent receives structured error, surfaces to dashboard ("Launch blocked: balance below floor — please top up.")

## Ops-Side Checks (Per Sub-Company During First Week)

- [ ] Daily: review any disapproved ads on this sub-company's networks
- [ ] Daily: confirm spend polls succeeded, no missing data
- [ ] Day 7: review whether sub-company is active or quietly broken
- [ ] Day 7: audit creative quality for policy risk patterns

## Common Failure Modes

| Symptom | Action |
|---------|--------|
| Stripe KYC stuck > 24h | Surface to founder, link to Stripe support upload, ops monitors |
| Meta child ad account creation fails | Check parent BP capacity, business verification status; retry once; escalate |
| TikTok provisioning slow | Often takes 24h naturally; monitor without action unless > 48h |
| Google MCC link fails | Verify developer token + login_customer_id headers |
| Founder doesn't top up | After 7 days idle, send "ready to launch?" email; archive after 30 days |
| Pixel install fails on independent domain | Founder needs to add tag manager / DNS — provide self-serve docs + 1-hour support call |

## Final Activation Confirmation

When all six steps green:

- [ ] Update `sub_companies.status='active'`
- [ ] Send activation email
- [ ] Add to weekly performance digest
- [ ] Sub-company is live and the agent is operating
