# 02 — Payments and Ledger

How money moves into and out of Zilla — Stripe Connect for revenue, the ad-credit ledger for ad spend, and the treasury layer that ties them together.

**Audience:** engineering, finance, product. Read after `ARCHITECTURE.md`.

**Companion docs:** `docs/03-engineering-spec.md` (database schema, webhook handlers) and `docs/05-compliance.md` (legal posture).

---

## 1. Stripe Connect — Why Express, Not Standard or Custom

Stripe Connect has three account types. The choice cascades into every other decision.

| Type | Stripe relationship owner | KYC handled by | 1099-K issuer | UX control | Engineering effort |
|------|---------------------------|----------------|---------------|------------|---------------------|
| **Standard** | Sub-company has full Stripe account | Sub-company self-onboards | Sub-company | Low (Stripe-branded) | Lowest |
| **Express** | Stripe ⇄ Zilla, sub-company in middle | Stripe (with minimal Zilla data) | Stripe, Zilla branded | High | Medium |
| **Custom** | Zilla owns the entire experience | Zilla collects, Stripe processes | Zilla, fully branded | Total | High |

**Use Express.** Reasons:

- Stripe handles KYC, AML, sanctions screening, identity verification — these are blocking gates we do not want to build
- Stripe is the merchant of record, which keeps Zilla outside money-transmitter law in most US states (see `docs/05-compliance.md`)
- ~90% of UX is white-labeled — sub-companies see "powered by Stripe" copy in a few places but not Stripe's branding throughout
- Application fees (`application_fee_amount`) flow automatically to the Zilla platform account
- Express handles 1099-K issuance for sub-companies past the threshold

**When to reconsider Custom:** if Zilla ever wants to issue physical cards to sub-companies via Stripe Issuing, or fully control the look-and-feel of refunds/disputes pages. Not relevant in v1.

---

## 2. The Two Stripe Account Roles

Zilla has exactly two Stripe-account roles. Keep them straight.

**Zilla Platform Account** — the root account. Owns:
- All sub-company connected accounts (Express type)
- Customer-facing card on file (founders pay Zilla for subscriptions and ad credit top-ups here)
- Application fees collected from each Connect transaction

**Sub-Company Connected Account** — one per sub-company, Express type. Owns:
- Merchant identity for the sub-company
- End-customer charges for the sub-company's product/service
- Payouts to the sub-company's bank
- 1099-K reporting

**Critical:** the Zilla Platform Account does NOT pay Meta from its Stripe balance. Stripe is for receiving customer payments and orchestrating Connect. Outbound ad-network payments come from Zilla's actual bank/corporate card. Don't conflate these.

---

## 3. Sub-Company Stripe Onboarding

For each new sub-company, call Stripe Connect's account creation API:

```
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
    "zilla_sub_company_id": "subc_abc123",
    "zilla_founder_user_id": "user_xyz789"
  }
}
```

Returns `acct_xxx`. Save to `sub_companies.stripe_connect_account_id`.

Then create an Account Link for KYC:

```
POST /v1/account_links
{
  "account": "acct_xxx",
  "refresh_url": "https://zilla.so/onboarding/refresh",
  "return_url":  "https://zilla.so/onboarding/done",
  "type": "account_onboarding"
}
```

Founder completes Stripe-hosted onboarding. Webhook `account.updated` fires when KYC is complete. Until then, the sub-company can't accept charges (though the rest of Zilla — site, ad accounts — can run).

---

## 4. Revenue Flow (End Customer → Sub-Company)

When the sub-company sells something, Zilla creates a charge with `application_fee_amount`:

```
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

What happens:

1. End customer's card is charged $100.
2. Stripe deducts processing fee ~$3.20 (2.9% + $0.30 — destination charge model deducts Stripe fees off the top first).
3. Of remaining ~$96.80: $20 to Zilla as application fee, ~$76.80 to sub-company's connected account.
4. Funds settle to sub-company on Stripe's standard schedule (T+2).
5. Webhook `charge.succeeded` fires. Engineering writes a row to `revenue_transactions`.

### 4.1 Refund policy

When a refund happens on a destination charge, the application fee can be refunded automatically (`refund_application_fee=true`) or kept (default).

**Zilla policy:** refund the platform fee on customer refunds within 30 days, keep it after. This is in the ToS.

### 4.2 Disputes

Stripe sets a dispute reserve on the connected account. Engineering must handle `charge.dispute.created` webhook and notify the founder.

**Zilla policy:** founder is responsible for dispute response, Zilla holds funds in escrow until resolution.

---

## 5. Ad Credit Top-Up Flow (Founder → Zilla Balance)

Founders pre-fund an Ad Credit balance to spend on ads. This is a one-time charge against the founder's saved card.

When the founder picks "$500 ad credits":

```
POST /v1/payment_intents
{
  "amount": 50000,
  "currency": "usd",
  "customer": "cus_yyyy",
  "metadata": {
    "zilla_purpose": "ad_credit_topup",
    "zilla_sub_company_id": "subc_abc123"
  }
}
```

This charge lands in the **Zilla Platform Account** (not the sub-company's connected account). Increases `ad_credit_balances.balance_cents` for that sub-company by $500.

Webhook `payment_intent.succeeded` writes:

```json
{
  "type": "topup",
  "amount_cents": 50000,
  "source": "stripe_pi_xxx",
  "status": "settled",
  "company_id": "subc_abc123"
}
```

---

## 6. Ad Credit Deduction Flow (Networks Charge Zilla)

This is the hardest part of the system. Ad networks bill Zilla **in arrears**, not real-time. Zilla deducts from the founder's balance immediately as ads run (so the founder can't overspend) but reconciles against actual network invoices later.

Three states for any dollar of ad spend:

1. **Authorized** — agent or founder has launched a campaign with a daily budget. Funds reserved against balance, not yet deducted.
2. **Pending** — ads have run today (per network reporting API), but the network hasn't actually invoiced Zilla yet. Funds deducted from balance, status pending.
3. **Settled** — the network has charged Zilla's corporate card. Pending becomes settled.

### 6.1 Daily spend polling

A cron job per network runs every 4–6 hours and pulls actual spend per ad account:

**Meta:**
```
GET https://graph.facebook.com/v19.0/{ad-account-id}/insights
  ?fields=spend
  &date_preset=today
  &access_token={system_user_token}
```

**TikTok:**
```
GET /open_api/v1.3/report/integrated/get/
  ?advertiser_id={advertiser_id}
  &report_type=BASIC
  &dimensions=["advertiser_id"]
  &metrics=["spend"]
  &start_date={today}
  &end_date={today}
```

**Google Ads (via Google Ads API):**
```sql
SELECT metrics.cost_micros
FROM customer
WHERE segments.date = TODAY
```

**X Ads (via Ads API):**
```
GET /12/stats/accounts/:account_id?entity=ACCOUNT&metric_groups=BILLING&...
```

Each cron run computes `spend_today_cents - spend_already_deducted_cents` per sub-company per network. Delta is deducted from balance and written as a `pending` ad_credit_transaction.

### 6.2 Settled reconciliation

Networks bill Zilla's corp card daily (Meta) or on threshold spend (TikTok, Google). When the bank webhook (or manual finance import) confirms the actual charge:

- Match the charged amount against the sum of pending transactions for that network in that period
- Transition matching transactions from `pending` → `settled`
- If there's a delta vs. our pending estimate, write a reconciliation transaction (positive or negative) and flag for finance review

**Why polling and not webhooks:** Meta has no real ads-billing webhook. TikTok and X are similar. Google Ads has limited push. Polling is the only reliable model. Build for it from day one.

### 6.3 Spend caps (hard stops)

The ledger enforces three caps, in increasing strictness:

1. **Per-campaign daily cap** — set on the network at campaign creation. The agent cannot exceed this.
2. **Per-sub-company daily cap** — checked in Zilla's middleware before any agent action. If today's spend would exceed this, the agent's API call is blocked.
3. **Balance floor** — if the sub-company's `ad_credit_balance` minus pending spend falls below $50 (safety buffer), Zilla automatically pauses all campaigns on all networks for that sub-company.

The third cap is the single most important safety mechanism in the system. An autonomous agent with unbounded ad-spend authority is the failure mode that takes the company down.

---

## 7. Treasury Operations

Zilla holds **float** between when founders fund ad credits and when networks invoice. This requires a real treasury function.

### 7.1 Float math

Steady-state example for a sub-company spending $1,000/mo on ads:
- Founder funds $1,000 → sits in Zilla bank for ~30 days as ads run
- Ad networks invoice ~daily, deducting from Zilla's corp card
- Stripe deposits the $1,000 to Zilla's bank within 2 business days of the top-up
- Net: Zilla holds ~$1,000 of float per active sub-company on average

At 100 sub-companies × $500 avg balance = $50k of float held. At 1,000 sub-companies = $500k. This is the cashflow Zilla manages.

### 7.2 Banking setup

Recommended setup:
- Primary operating account at **Mercury** or **Brex** (FDIC-insured, instant ACH)
- Separate "ad credit float" sub-account, ledger-tracked, never co-mingled with operating funds
- Backup card on a different card network (if primary is Visa, backup is Amex or vice versa)
- Sweep idle float into a treasury product (Mercury Treasury, Brex Cash) — at $500k+ this becomes ~$25k/yr in passive yield

### 7.3 Monthly close

A monthly finance close should reconcile:
- Sum of `ad_credit_transactions` (top-ups minus deductions) against bank statement balance
- Sum of `revenue_transactions.application_fee_cents` against Stripe platform balance
- Network invoices against `ad_credit_transactions` by network and period
- Outstanding pending-not-yet-settled ad credit deductions (the "in-flight" liability)

Drift > 1% is a signal of a real problem. Drift > 5% requires immediate investigation.

---

## 8. The Stablecoin Path (V2 Optional)

The architecture is designed so the V2 USDC path requires zero schema rework.

- **Phase 1 (today):** Founder funds via Stripe (card). Zilla holds USD in bank. Zilla's corp Visa pays Meta. Visa interchange takes ~1.5–2% of every dollar.
- **Phase 2 (V2):** Founder funds via USDC. Zilla holds USDC on chain. When Meta bills, Zilla settles fiat from a USDC-backed credit card (Stripe Issuing collateralized by USDC, or partners like Bridge / Mercuryo / KAST). Interchange savings become Zilla's economics.
- **Phase 3 (V3):** Meta supports stablecoin settlement directly. Zilla becomes pure orchestration; settlement is on-chain. This is the demand sink for emerging payments networks the Zilla thesis was built around.

To support Phase 2, add a new `source_kind = "usdc_onchain"` and a webhook handler watching a Zilla-controlled stablecoin address. No other changes.

---

## 9. Refunds, Disputes, and Edge Cases

**Founder requests refund of unspent ad credits.** Allowed up to the unspent amount minus pending charges. Refund flow goes through Stripe (refund the original payment intent if within 90 days; else issue manual ACH and write a reversing ledger entry).

**Sub-company disputes Zilla's charge** (e.g., founder disputes a subscription or ad credit top-up). Comes off Zilla's platform account. Mitigation: clear billing descriptors, transparent dashboard, refund policy that's easier than disputing.

**Sub-company gets banned on a network.** Their ad account, page, pixel become unusable. Mark `ad_network_accounts.status = banned`, pause campaigns, notify founder. Credit balance carries over to a re-provisioned account if the network allows it (often won't).

**Network charges Zilla MORE than polled spend.** Happens when ads ran late or the network had a billing reconciliation. Reconciler writes a corrective transaction. Above 5% drift → alert finance.

**Stripe Connect account hits payout block.** Stripe places "review" holds on connected accounts that look risky. Handler for `account.updated` must surface this to the founder.

**Sub-company off-boards.** Founder requests data export + leaves. Account stays in DB (tax history) but `status = offboarded`, all tokens revoked, all campaigns paused, final ad credit balance refunded.
