# Engineering Spec — Zilla Merchant Template

The build spec for zilla-v2's payment + ad infrastructure layer. Anyone implementing this should be able to start here without further specs.

**Audience:** engineers building zilla-v2.
**Read first:** `ARCHITECTURE.md`.
**Pairs with:** `schema/postgres-init.sql` (runnable DDL), `docs/02-payments-and-ledger.md` (Stripe specifics), `docs/01-ad-network-setup.md` (per-network platform details).
**Last updated:** 2026-05-04.

---

## 1. System Components

```
┌─────────────────────────────────────────────────────────────┐
│  Founder Dashboard (Next.js, zilla.so)                       │
└──────────────┬──────────────────────────────────────────────┘
               │ tRPC / REST
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Zilla API / Middleware                                      │
│  - Authn/authz                                               │
│  - Stripe orchestration                                      │
│  - Ad-network adapters (per-network clients)                 │
│  - Spend cap enforcement                                     │
│  - Ledger writes                                             │
└────┬────────────┬─────────────────┬───────────────┬─────────┘
     │            │                 │               │
     ▼            ▼                 ▼               ▼
┌─────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────┐
│Postgres │  │  Stripe  │  │ Meta/TikTok/ │  │  AI Agent   │
│ Ledger  │  │  Connect │  │ Google/X     │  │  (separate  │
│         │  │          │  │ Marketing    │  │   service)  │
└─────────┘  └──────────┘  │ APIs         │  └─────────────┘
                           └──────────────┘
```

Subsystems and their responsibilities:

- **Founder dashboard** — Read-only views of revenue, ad credits, performance. Action triggers (top up, pause agent, off-board). No business logic.
- **Zilla API / Middleware** — Single source of truth for actions. Every spend authorization, every Stripe call, every network call passes through here. The agent and the dashboard both call it; neither bypasses it.
- **Postgres ledger** — Append-only ledger plus state tables. Hot path: read balance, write transactions. Backups, PITR, and read replicas mandatory before live spend.
- **Stripe** — Connect for revenue, regular charges for top-ups and subscriptions.
- **Ad-network adapters** — Thin per-network clients (Meta, TikTok, Google, X). All implement a common interface (launch, pause, fetch_spend, fetch_status). All adapter calls go through middleware.
- **AI agent** — A separate service. Stateless from a financial standpoint. Operates by calling the middleware. Never holds tokens directly.

## 2. Data Model

The full Postgres schema lives in `schema/postgres-init.sql`. Summary of tables and their roles:

| Table | Role | Key fields |
|-------|------|------------|
| `users` | Founders. Auth-managed. | id, email |
| `sub_companies` | One per business launched on Zilla | id, founder_user_id, name, slug, stripe_connect_account_id, status |
| `ad_network_accounts` | One row per (sub-company, network) pair | sub_company_id, network, external_account_id, daily_spend_cap_cents |
| `ad_credit_balances` | Materialized cache of current ad-credit balance | sub_company_id, balance_cents, pending_cents |
| `ad_credit_transactions` | Append-only ledger of credit movements | type, amount_cents, status, source_kind, source_id |
| `revenue_transactions` | End-customer charges via Stripe Connect | sub_company_id, gross_cents, application_fee_cents, status |
| `ad_campaigns` | Active campaigns across networks | sub_company_id, network, external_campaign_id, daily_budget_cents |
| `network_api_tokens` | Encrypted API tokens, scoped least-privilege | network, token_kind, token_encrypted, scope, rotated_at |

### 2.1 Invariants

- `ad_credit_transactions` is **append-only**. No updates, no deletes. Reversals are new rows with negative amounts referencing the original `source_id`.
- `ad_credit_balances` is a **materialized cache**. Truth = sum of transactions for that sub-company. Daily reconciler must alert on drift > $0.01.
- All amounts in cents (`BIGINT`). Never floats.
- All timestamps in UTC.
- Deletes are soft (`status` field). Sub-company history is forever — needed for tax records.
- Every external_id (Stripe, Meta, etc.) is unique per source — collision-impossible by schema.

## 3. Stripe Integration

### 3.1 Webhook Handlers

All handlers must:
- Verify `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`.
- Reject events with timestamps outside Stripe's 5-minute window (replay protection).
- Be **idempotent** — check whether `source_id` already exists in the relevant table before writing.
- Return 2xx in <5 seconds. Heavy work belongs in a queue.

Required handlers:

| Event | Action |
|-------|--------|
| `account.updated` | Update sub-company onboarding status; activate when KYC complete |
| `payment_intent.succeeded` | Branch on `metadata.zilla_purpose`:<br>• `ad_credit_topup` → credit `ad_credit_balances`, write topup tx<br>• otherwise → write `revenue_transactions` row |
| `charge.succeeded` | Confirm revenue transaction (for destination charges with `application_fee`) |
| `charge.refunded` | Reverse `revenue_transactions` row; reverse application fee per policy (30-day rule) |
| `charge.dispute.created` | Pause sub-company, notify founder, flag for finance |
| `charge.dispute.closed` | Update dispute status |
| `account.application.deauthorized` | Sub-company has revoked Zilla's Stripe access — pause everything |
| `payout.paid` | Optional, for showing payout history in dashboard |

### 3.2 Outbound Stripe Calls

Account creation (sub-company onboarding):

```http
POST /v1/accounts
{
  "type": "express",
  "country": "US",
  "email": "founder@example.com",
  "capabilities": {
    "card_payments": { "requested": true },
    "transfers":     { "requested": true }
  },
  "business_type": "individual",
  "metadata": {
    "zilla_sub_company_id":  "subc_abc123",
    "zilla_founder_user_id": "user_xyz789"
  }
}
```

Account onboarding link:

```http
POST /v1/account_links
{
  "account":      "acct_xxx",
  "refresh_url":  "https://zilla.so/onboarding/refresh",
  "return_url":   "https://zilla.so/onboarding/done",
  "type":         "account_onboarding"
}
```

End-customer revenue charge (destination charge with application fee):

```http
POST /v1/payment_intents
{
  "amount": 10000,
  "currency": "usd",
  "application_fee_amount": 2000,
  "transfer_data": { "destination": "acct_xxx" },
  "metadata": {
    "zilla_sub_company_id": "subc_abc123",
    "end_customer_email":   "buyer@example.com"
  }
}
```

Ad-credit top-up (lands in Zilla platform account, not sub-account):

```http
POST /v1/payment_intents
{
  "amount": 50000,
  "currency": "usd",
  "customer": "cus_yyyy",
  "metadata": {
    "zilla_purpose":        "ad_credit_topup",
    "zilla_sub_company_id": "subc_abc123"
  }
}
```

## 4. Ad-Network Polling Jobs (Not Webhooks)

Networks bill Zilla in arrears with no real billing webhooks. The system polls every network every 4–6 hours and reconciles overnight.

| Job | Frequency | Action |
|-----|-----------|--------|
| `meta_spend_poller` | every 4 hours | Pull spend per Meta ad account; write deduction tx with `status=pending` |
| `tiktok_spend_poller` | every 4 hours | Same for TikTok |
| `google_spend_poller` | every 4 hours | Same for Google Ads |
| `x_spend_poller` | every 6 hours | Same for X (lower priority) |
| `network_invoice_reconciler` | nightly | Match settled invoices against pending tx; transition to `settled` |
| `balance_safety_check` | every 15 min | Pause campaigns for sub-companies near zero balance (floor: $50) |
| `balance_drift_check` | nightly | Verify materialized balance matches sum of transactions; alert on drift |
| `token_rotator` | weekly | Rotate System Users / refresh tokens approaching expiry |

### 4.1 Polling Endpoints

**Meta Marketing API:**
```http
GET https://graph.facebook.com/v19.0/{ad-account-id}/insights
   ?fields=spend
   &date_preset=today
   &access_token={system_user_token}
```

**TikTok Business API:**
```http
GET /open_api/v1.3/report/integrated/get/
   ?advertiser_id={advertiser_id}
   &report_type=BASIC
   &dimensions=["advertiser_id"]
   &metrics=["spend"]
   &start_date={today}
   &end_date={today}
```

**Google Ads API (GAQL via SearchStream):**
```sql
SELECT metrics.cost_micros
FROM customer
WHERE segments.date = TODAY
```

**X Ads API:**
```http
GET /12/stats/accounts/:account_id?entity=ACCOUNT&metric_groups=BILLING&...
```

### 4.2 Polling-to-Ledger Logic

For each poll cycle, per (sub-company, network):

1. Fetch `spend_today_cents` from network.
2. Read existing pending+settled deductions for the same (sub_company, network, spend_period_start = today).
3. Compute `delta = spend_today_cents - sum_of_existing_deductions`.
4. If `delta > 0`: write a new `ad_credit_transactions` row with `status='pending'`, `amount_cents = -delta`. Update `ad_credit_balances` (decrement `balance_cents`, increment `pending_cents`).
5. If `delta < 0`: network corrected down. Write a positive corrective transaction.
6. If `delta == 0`: nothing to write.

### 4.3 Settled Reconciliation

When the bank webhook (Mercury / Brex / Ramp) confirms an actual ad-network charge to Zilla's corp card:

1. Match charged amount against sum of pending transactions for that network in that billing period.
2. Transition matching transactions from `pending` → `settled`. Move `pending_cents` → out of pending bucket.
3. If there's a delta (network over-/under-charged vs. our estimate), write a reconciliation transaction (positive or negative) and flag for finance review if delta > 5%.

## 5. Spend Caps (Hard Stops)

The middleware enforces three caps in strictness order:

1. **Per-campaign daily cap** — set on the network at campaign creation (Meta `daily_budget`, etc.). Network refuses to spend more.
2. **Per-sub-company daily cap** — checked in middleware before any agent action. Reads `SUM(ad_credit_transactions WHERE sub_company_id = X AND created_at >= today_utc)` and rejects if launching this campaign would exceed `sub_companies.daily_spend_cap_cents`.
3. **Balance floor** — if `(balance_cents - pending_cents) < 5000` ($50), middleware:
   - Rejects all new campaign launches
   - Triggers `pause_all_campaigns(sub_company_id)` across networks
   - Notifies founder via email + dashboard banner

The third cap is the single most important safety mechanism. An autonomous agent with unbounded ad-spend authority is the failure mode that takes the company down.

## 6. AI Agent Authority Boundary

The AI agent (separate service) **cannot**:
- Modify ledger rows
- Call Stripe directly
- Call ad networks directly (no token access)
- Bypass middleware

The agent **can**:
- Call middleware actions: `launchCampaign`, `pauseCampaign`, `updateCampaignBudget`, `rotateCreative`, `fetchPerformance`
- Read its own scoped data (campaigns, performance, spend) for the sub-companies it operates

```
Agent  ──launchCampaign(sub_company, network, daily_budget, creative)──▶  Zilla Middleware
                                                                             │
                                                                             ├─ Authn: agent service token, scoped to (sub_company)
                                                                             ├─ Check sub-company balance >= safety floor ($50)
                                                                             ├─ Check agent's per-action rate limit
                                                                             ├─ Check daily_budget <= per-sub-co cap
                                                                             ├─ Apply per-network API call
                                                                             └─ Write ad_campaigns row
```

If any check fails: reject with structured error, log to `agent_action_log`. The agent surfaces the rejection back to the founder dashboard ("I tried to launch X campaign but balance is too low — please top up").

## 7. Per-Network Adapter Notes

### 7.1 Meta (Marketing API + Conversions API)

- Base: `https://graph.facebook.com/v19.0/`
- Token: System User access token from Business Settings (60-day, auto-refresh).
- Required scopes: `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, `instagram_manage_insights`.
- Rate limits: ~200 calls/hour/user (varies by app review tier). Build exponential backoff.
- All campaigns must include `special_ad_categories` field (`[]` for non-special; required even when empty since 2023).
- CAPI events sent server-side from middleware (not from the founder's site) so iOS 14.5 attribution still works.

### 7.2 TikTok (Marketing API)

- Base: `https://business-api.tiktokglobalshop.com/open_api/v1.3/`
- Token: Long-lived advertiser-scoped access token via OAuth in Business Center.
- Rate limits: 60 req/min/token (more generous than Meta).
- Spark Ads (boosting organic creator content) is the highest-ROI placement; every sub-company should have organic TikTok account linked to its advertiser.

### 7.3 Google Ads (Google Ads API)

- Base: `https://googleads.googleapis.com/v18/`
- Auth: OAuth2 with `customer_id` (sub-co) + `login_customer_id` (Zilla MCC) headers.
- **Developer token** — one Zilla-wide token, applied for via API Center, takes 1–7 days for basic level. **Apply now**, even before integration is built.
- Required: `customer.descriptive_name`, `linked_account_id` (MCC) on every API call.

### 7.4 X (Ads API)

- Base: `https://ads-api.x.com/12/`
- Auth: OAuth1.0a (X has not migrated to OAuth2 for Marketing API).
- Tier required: paid Ads API subscription ($100+/mo as of 2026).
- Lower priority than Meta/TikTok/Google. May not be worth integrating in v1.

## 8. Idempotency Patterns

Every external-call site must be idempotent under retry. The patterns we use:

- **Stripe** — set `Idempotency-Key` header on every POST that mutates state. Use `${sub_company_id}:${operation}:${nonce}`.
- **Webhook handlers** — check whether `source_id` already exists in target table before writing. Return 200 if it does (Stripe will stop retrying).
- **Polling jobs** — re-running today's poll for the same (sub-company, network, day) must produce zero net effect (delta = 0 ⇒ no new rows).
- **Agent actions** — middleware accepts a client-supplied `idempotency_key`. Re-launching the same campaign within 5 min returns the existing campaign id, not a new one.

## 9. Security & Secrets

- All ad-network tokens encrypted at rest with KMS (AWS KMS, GCP KMS, or equivalent). Stored in `network_api_tokens.token_encrypted` (BYTEA).
- Tokens decrypted only inside the middleware service, in memory, never logged.
- Stripe secret key, webhook secret in environment / secrets manager, rotated quarterly.
- Per-environment isolation: dev / staging / prod each have their own Stripe accounts, Meta apps, etc. **Do not** share tokens across environments.
- Audit trail: every middleware action writes to `agent_action_log` (or equivalent), including actor (agent vs human), timestamp, action, target.
- Per-token least-privilege scopes — never request `business_management` if the action only needs `ads_read`.
- Database: row-level security on multi-tenant tables (sub-company isolation), connection-pool credentials with read-only vs read-write separation.

## 10. Observability

Required metrics from day one:

- **Per-sub-company daily ad spend** across networks, with cap-vs-actual.
- **Ledger drift alarm** — materialized balance vs. transaction sum diff; alert on >$0.01.
- **Stripe webhook lag** — time from event creation to processed.
- **Network polling lag and error rate** per network.
- **Per-token API call volume** so we can predict rate-limit collisions before they happen.
- **Disputes open / closed / lost** — Connect-wide and per-sub-company.
- **Pending-to-settled latency** — ad-spend reconciliation health.
- **Balance-floor pauses** — count per day; spike = a sub-company with bad ROAS.

Required logs:

- Every middleware action with actor, sub-company, network, action, outcome
- Every webhook receipt with event id and processing duration
- Every polling job run with duration, rows written, errors
- Every spend cap rejection with reason and current balance state

## 11. Failure Modes (What Will Go Wrong)

In rough order of frequency:

1. **Meta disapproves an ad.** No webhook for this; you find out via the ad object's `effective_status`. Poller detects → notifies founder + agent.
2. **Sub-company exhausts ad credits mid-campaign.** Balance safety check pauses at $50 floor. Per-network pause adapters required.
3. **Stripe Connect account hits a payout block.** Stripe places "review" holds on risky-looking accounts. `account.updated` handler must surface this.
4. **Meta charges more than polled spend.** Reconciler writes a corrective tx. >5% drift → alert finance.
5. **Sub-company gets banned on Meta.** Ad account, page, pixel become unusable. Mark `ad_network_accounts.status = banned`, pause campaigns, notify founder. Credit balance carries over to a re-provisioned account if Meta allows (often won't).
6. **Founder requests refund of unspent ad credits.** Allowed up to unspent minus pending. Refund original PI if within 90 days; else manual ACH + reversing ledger entry.
7. **Network API rate limits.** Adapters must implement exponential backoff. Polling jobs distribute calls across the day, not run all at top of hour.
8. **Stripe webhook signature fails.** Reject silently and log. Stripe retries 3 times; manual reconciliation cron after that.
9. **Sub-company off-boards from Zilla.** Account stays in DB (tax history). `status = offboarded`. Tokens revoked. Campaigns paused. Final balance refunded.

## 12. Test Strategy

- **Unit tests** — adapters, middleware authz checks, ledger math (especially reversals and drift).
- **Integration tests** — Stripe Connect end-to-end against Stripe test mode. Use `application_fee` flow and assert ledger writes match.
- **Load tests** — simulated 1000-sub-company state, webhook stream at 10x peak, polling at full network width. Catches DB hot-spots.
- **Chaos drills** — simulate Meta token revocation, Stripe webhook outage, balance-floor pause cascade. Document the recovery runbook in `docs/06-operations-playbook.md`.
- **Pre-launch sandbox** — every founder-facing flow tested in Stripe test mode with a fake sub-company before any real money moves.

## 13. Open Questions

1. **Application fee % final?** 20% (this doc) or 15% (prior PRD)? Engineering treats this as a config value either way; resolve with finance before launch.
2. **Run middleware as monolith or split into Stripe service + ad-network service?** Recommend monolith in v1 — speed of change matters more than horizontal scale at this stage.
3. **Where does the corp card live?** Mercury vs Brex vs Ramp affects the bank-webhook integration for settlement reconciliation. Operations decision.
4. **Token rotation cadence?** Weekly is conservative; monthly probably fine for production. Build the cadence config-driven.
5. **Multi-currency support?** Schema supports it, but v1 is USD-only. Open the second currency only when revenue > $0 demands it.
