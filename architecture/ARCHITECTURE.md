# Architecture — Zilla Merchant Template

**One-page system overview.** Read this after the README, before any of the deep-dive docs in `/docs`.

**Last updated:** 2026-05-04

---

## The Core Model

Zilla is a one-click AI company creation platform. End users (we call them **founders**) sign up, describe a business, and Zilla provisions the full infrastructure: a brand, a website, a Stripe payment-acceptance setup, and ad accounts on Meta, TikTok, Google, and X. The AI agent then operates the business — generates content, runs ads, optimizes campaigns — while the founder reviews from a dashboard.

The hard part is not the agent. The hard part is the **infrastructure abstraction**: founders do not have verified Business Portfolios at Meta, do not have Stripe merchant accounts of their own, do not have business credit, and cannot get any of those things in the timeframe they want to launch. Zilla absorbs all of that complexity by being the parent identity at every payment and ad network, with each sub-company existing as a child account inside Zilla's verified, billed, and trusted parent.

That abstraction is the moat. The agent is the demo.

---

## Two Money Flows

The architecture has exactly two distinct money flows. Keep them straight in your head and the rest follows.

### Flow 1 — Revenue (sub-company's customers pay sub-company)

```
End customer  ──$100──▶  Stripe Connect  ──▶  Sub-company connected account
                                  │
                                  ├──$3.20 Stripe processing fee
                                  ├──$20.00 application_fee → Zilla platform
                                  └──$76.80 → sub-company payout
```

- Stripe is the merchant of record for the end-customer transaction
- Stripe Connect Express manages KYC, payouts, 1099-K, sanctions screening
- Zilla takes a 20% **application fee** on every charge (matches Polsia)
- Sub-company gets the rest, paid out to their bank on Stripe's standard schedule (T+2)
- This is the **margin** flow — it's where Zilla makes money in V1

### Flow 2 — Ad Spend (founder pays Zilla, Zilla pays the ad networks)

```
Founder  ──tops up──▶  Stripe Payment  ──▶  Zilla Ad Credit Balance
                                                    │
                                                    │ (ledger deducts as ads run)
                                                    ▼
                  Zilla Corp Card  ──▶  Meta / TikTok / Google / X
                  (Zilla's parent BP/BC/MCC, child ad accounts per sub-co)
```

- Founder pre-funds an Ad Credit balance via Stripe (e.g., $500)
- Zilla's corporate card is on file at every ad network
- As the agent or founder runs ads, networks bill Zilla in arrears
- Zilla's middleware deducts from the founder's balance 1:1 with actual network spend
- This is the **strategic** flow — no margin today, but it's the merchant-of-record relationship that becomes a stablecoin demand sink in V2

**Why the two flows must stay separate:** they have different legal postures (Stripe is MoR for Flow 1, Zilla is functional MoR for Flow 2), different ledger semantics (revenue is income, ad credits are a liability/escrow), different reconciliation patterns (real-time webhook for Stripe, polling for ad networks), and different failure modes. Conflating them in code or in the dashboard creates compliance and customer-trust problems.

---

## The Parent/Child Account Pattern

```
                 ┌──────────────────────────────┐
                 │   ZILLA INC. (legal entity)   │
                 │   Stripe platform account     │
                 │   Corporate card / bank       │
                 └──────────────────────────────┘
                              │
        ┌────────────┬────────┴────────┬────────────┬────────────┐
        ▼            ▼                 ▼            ▼            ▼
   Meta Business  TikTok Business  Google Ads    X Ads       Stripe
   Portfolio      Center           MCC           Account     Connect
                                                              (Express)
        │            │                 │            │            │
   ┌────┼────┐  ┌────┼────┐       ┌────┼────┐  ┌────┼────┐  ┌────┼────┐
   ▼    ▼    ▼  ▼    ▼    ▼       ▼    ▼    ▼  ▼    ▼    ▼  ▼    ▼    ▼
   SC1  SC2  SC3 SC1 SC2 SC3      SC1 SC2 SC3 SC1 SC2 SC3 SC1 SC2 SC3
   Page IG  Pixel Adv Pixel       GAds GA4 Conv X    X    X  Acct Acct Acct
   Ad   Ad  Page  Acct Spark      Acct Prop      Acct Acct Acct
   Acct Acct Acct      Ads
```

(SC1 / SC2 / SC3 = sub-companies, e.g. SiteGrid, Brand-B, Brand-C)

Every sub-company is a child of the Zilla parent on every platform. The Zilla parent owns the verification, the billing, the API tokens. The child holds the brand-specific assets — page, pixel, ad account, Stripe Connect sub-account.

**Critical implication:** sub-companies cannot graduate off Zilla and take their ad accounts with them. The accounts live inside Zilla's parent. When founders off-board, they have to set up their own parent infrastructure elsewhere. This is identical to Polsia and should be in the ToS up front. (Stripe Connect sub-accounts can in some cases be transferred via Stripe support; this is the only graduation lever.)

---

## What Each Layer Owns

**Zilla Platform Layer (parent)**
- Legal entity, EIN, business address, identity verification
- Corporate card / bank account
- One Business Portfolio, one Business Center, one Manager Account, one Stripe platform account
- Domain `zilla.so` (verified at Meta, anchors all `*.zilla.so` subdomain sub-companies)
- All API tokens (Meta System User, TikTok BC member, Google MCC dev token, X OAuth)
- Float on ad credit balances (between when founder funds and when networks invoice)

**Sub-Company Layer (child, one set per sub-company)**
- Brand name, domain (subdomain or independent), brand assets
- Facebook Page + Instagram Business Account + Meta Pixel + Conversions API setup
- TikTok Business + Advertiser account + TikTok Pixel
- Google Ads child account + GA4 property + Google Tag
- X handle + X Ads account
- Stripe Connect Express account (founder-KYC'd by Stripe)
- Founder's bank account on file (for Stripe payouts of revenue)

**Founder Layer (the user)**
- Identity, authenticated to Zilla
- Sees a dashboard with Revenue, Ad Credits, Performance modules
- Can pause the agent, top up ad credits, request payouts, off-board
- Never sees Meta / TikTok / Google / X UIs directly

**AI Agent Layer (the demo)**
- Calls Zilla's middleware to launch / pause / optimize campaigns
- Cannot bypass middleware to call networks directly
- Cannot modify ledger or call Stripe
- Operates within per-action and per-sub-company spend caps enforced by middleware

---

## What Zilla Charges and How

Three line items, kept visually separate on every founder statement:

1. **Subscription** — recurring monthly (e.g., $99/mo). Platform access, agent operations, infra.
2. **Ad credit top-ups** — founder-initiated prepaid balance. **Goes 1:1 to actual ad spend at networks. No markup.**
3. **Application fee on revenue** — 20% of every Stripe charge through the sub-company's connected account. Deducted automatically by Stripe Connect's destination-charge mechanism.

The transparency of "$100 of ad credits = $100 of actual ad spend" is intentional. It's a trust-builder, matches Polsia's model, and avoids the compliance risk of ad reselling (Meta hates that).

---

## Why This Doesn't Make Us a Money Transmitter

Two-part argument, full version in `docs/05-compliance.md`:

1. **Revenue flow:** Stripe Connect Express makes Stripe the merchant of record. Zilla takes an application fee, which is income (not custody). Same legal posture as Whop, Patreon, Substack.

2. **Ad credit flow:** Closed-loop prepaid balance. Funds can only be spent on ads via Zilla — cannot be withdrawn as cash, transferred between sub-companies, or used elsewhere. Refundable. Short float. This is the same posture as a coffee shop's prepaid gift card or DoorDash credits — generally exempt from MTL in most US states. Get a money-transmission lawyer's opinion before crossing $1M held float.

---

## Open Questions (Decide Before Engineering Starts)

1. **Application fee %** — 20% (matches Polsia, what this doc currently assumes) or 15% (per prior Zilla V3 PRD)? **Recommend 20%.**
2. **Minimum ad credit top-up** — $100 or smaller for trial users?
3. **BYOM (bring your own card) escape valve** — allow advanced sub-companies to bypass Zilla's ad-credit balance? **Recommend NO** — loses the demand-sink architecture.
4. **Stripe Connect Standard graduation** — let high-revenue sub-companies migrate to a Standard account they own? **Recommend yes**, gated by revenue threshold.
5. **Meta Tech Provider application timing** — apply before scaling past 25 active sub-companies, or wait until pressed?
6. **Treasury setup** — Mercury, Brex, Ramp, or split? Affects yield on float.
7. **USDC funding path** — V2; pick fiat-bridge partner (Bridge, Mercuryo, KAST).

---

## Where The Detailed Specs Live

- Full ad-network setup (parent BP / BC / MCC creation, per-sub-company assets, verification, system users) → `docs/01-ad-network-setup.md`
- Full payments architecture (Stripe Connect Express, ad-credit ledger, reconciliation, treasury) → `docs/02-payments-and-ledger.md`
- Engineering spec (data model, webhooks, network polling, agent boundaries, observability) → `docs/03-engineering-spec.md`
- Founder UX (onboarding, dashboard, billing transparency, off-boarding) → `docs/04-product-and-ux.md`
- Compliance posture (MTL argument, KYC, chargebacks, tax) → `docs/05-compliance.md`
- Operations playbook (Day-0 bootstrap, per-sub-company onboarding, policy violations, scaling) → `docs/06-operations-playbook.md`

For practical "do this today" workflows: see `/checklists/`.
