# Compliance & Risk Posture — Zilla Merchant Template

The legal, MTL, KYC, chargeback, tax, and data-privacy posture for the Zilla payments architecture. This is not legal advice — it's a description of the design choices that put us in the right posture and the questions that need a lawyer's review before we cross specific thresholds.

**Audience:** legal, finance, exec, anyone writing the ToS.
**Read first:** `ARCHITECTURE.md`, `docs/02-payments-and-ledger.md`.
**Last updated:** 2026-05-04.

---

## 1. The Money-Transmitter Question

**Short answer: we are not a money transmitter, by design.** Both money flows are structured to keep us out of MTL jurisdiction.

### 1.1 Revenue flow (sub-company's customers → sub-company)

Stripe Connect Express puts **Stripe** as the merchant of record for the end-customer transaction. Zilla never holds end-customer funds in its own bank. Funds flow:

```
End customer ─▶ Stripe ─▶ Sub-company connected account ─▶ Sub-company bank
                  │
                  └─ application_fee (20%) ─▶ Zilla platform account ─▶ Zilla bank
```

Zilla collects an **application fee**, which is income to a software platform — not custody of someone else's money. This is the same legal posture as Whop, Patreon, Substack, and every other Stripe Connect platform.

Stripe takes responsibility for KYC, AML, sanctions screening (OFAC), and 1099-K issuance. Zilla relies on Stripe's compliance program and does not duplicate it.

### 1.2 Ad-credit flow (founder → Zilla balance → networks)

This one is trickier. Zilla holds founder-funded balances and disburses to ad networks. There is a colorable argument this is "stored value," which can trigger money-transmitter scrutiny in some states.

The mitigations baked into the design:

1. **Single-purpose closed loop.** Ad credits can only be spent on ads via Zilla. They cannot be transferred between sub-companies, withdrawn as cash, or used for anything outside Zilla's ad-network rails. This is the same closed-loop posture as a coffee-shop prepaid gift card or DoorDash credits — generally exempt from MTL in most US states.
2. **Stripe processes the top-up.** When the founder funds ad credits, Stripe is the receiving entity. Zilla holds the resulting USD in its corporate bank but only against a defined liability (the founder's ad-credit balance) backed 1:1.
3. **Refundable.** Ad credits are refundable to the founder per the policy in `docs/04-product-and-ux.md`. This makes it harder for a regulator to argue we're holding "value" the founder can't recover.
4. **Short float.** Funds typically sit in Zilla's bank for days, not months. Ads run quickly and burn the balance.

What this still doesn't fully resolve:

- **California, New York, and Texas** are aggressive on stored-value definitions. At meaningful scale (>$1M in float held at any one time), get a money-transmission lawyer's opinion. Some Connect platforms holding ad credits operate under Stripe Treasury or Stripe Issuing constructs to wrap themselves more cleanly inside Stripe's own MTL coverage. Worth exploring once we cross $1M in float.
- **State sales tax on ad credits** is an open question. Most states don't tax prepaid digital service credits, but a handful do. Stripe Tax can help when revenue scales.

### 1.3 Concrete trigger points for legal review

- Float > **$250k** held at any one time → tighten the closed-loop ToS, document it formally
- Float > **$1M** held at any one time → MTL lawyer opinion, evaluate Stripe Treasury wrap
- Operating in CA / NY / TX with > **$100k of float from residents in that state** → state-specific opinion
- Adding USDC top-up path (V2) → fresh legal review (new asset class, may bring crypto-money-transmission rules into scope depending on how custody is structured)
- Adding any ability to move credits between sub-companies, withdraw to bank, or use credits for anything other than ads → **the closed-loop argument breaks** and we likely become a money transmitter. Don't ship this without legal sign-off.

## 2. KYC / KYB

### 2.1 Sub-company KYC

Stripe Express handles individual KYC and (where applicable) business KYB. Zilla collects no separate KYC — we trust Stripe's. Sanctions screening: Stripe runs OFAC checks; we don't duplicate.

What we **do** do:

- Pull the verified identity status from Stripe via `account.updated` webhook and gate ad-network provisioning on it.
- Surface KYC pending / failed states to the founder.
- Allow founder to retry / contact Stripe support directly on a failed verification.

What we **don't** do:

- Re-collect ID documents
- Run our own AML or sanctions checks (Stripe does this)
- Hold funds for the founder before they pass Stripe's KYC

### 2.2 Zilla itself (corporate KYC/KYB at networks)

Each ad network requires Zilla to verify itself as a real business:

- Meta Business Verification (D-U-N-S, EIN, business address, sometimes utility bill/lease)
- TikTok Business Center identity verification (similar docs)
- Google Ads business identity (verified during MCC + sub-account setup)
- X Ads onboarding (lighter)

These are one-time per Zilla parent. See `docs/01-ad-network-setup.md` for what to provide.

Stripe also requires Zilla's platform account to complete corporate KYB before going live with Connect.

## 3. Anti-Fraud / Policy Enforcement

The biggest risk on an "AI launches a business in a click" platform is sub-companies using Zilla to spend ad credits on policy-violating offers (CBD, gambling, scam services, get-rich-quick, etc.). This is also where Meta / TikTok / Google will pressure us first. Mitigations:

### 3.1 Onboarding-time

Sub-company description and offer go through a content classifier. High-risk categories (financial advice, supplements, adult, gambling, weapons, crypto trading signals, MLM-flavored copy) flagged for human review **before ads can run**. Hard-blocked categories (illegal, deceptive, sanctioned) terminated at onboarding.

### 3.2 Campaign-launch time

Agent-generated creative is checked against Meta / TikTok / Google policy classifiers **before** submission to the network. This catches the obvious stuff before it gets a real disapproval that pollutes the parent account's reputation.

### 3.3 Post-launch

- Policy flags from networks come into a queue
- Pattern-match across sub-companies to detect coordinated abuse (e.g., 30 sub-companies launching the same scammy supplement)
- Auto-pause + manual review threshold: 3 disapprovals in 48h on a sub-company, or any account-level warning from a network

### 3.4 Termination

ToS gives Zilla unilateral right to terminate sub-companies for policy violations, with prorated refund of unspent ad credits. **Do not** make this a discretionary judgment call — write the policy categories explicitly in the ToS so terminations are predictable and defensible.

## 4. Chargebacks (Two Different Surfaces)

There are two distinct chargeback paths. Don't let your dashboard confuse them.

### 4.1 End customer disputes the sub-company's product

Stripe Connect destination-charge mechanics apply. The connected sub-account pays the dispute fee + the chargeback amount if lost.

- Stripe places a hold ("dispute reserve") on the connected account
- Zilla pauses the sub-company until the dispute is resolved
- Founder responds with evidence via the Zilla dashboard (which writes to Stripe)
- Application fee policy: **refund Zilla's 20% on customer refunds within 30 days, keep it after.** This is documented in ToS.

### 4.2 Founder disputes a Zilla charge

Subscription or ad-credit top-up. Comes off Zilla's platform account. Zilla pays the dispute fee + the chargeback if lost.

Mitigations:

- Clear billing descriptors on every Zilla charge ("ZILLA SUBSCRIPTION", "ZILLA AD CREDITS subc_abc123")
- Transparent dashboard showing every charge and its purpose
- Refund policy that's easier to use than disputing (1-click in dashboard for unspent ad credits within 90 days)
- Email confirmation of every Zilla charge with reference to dashboard

## 5. Tax

### 5.1 Sub-company income tax

The sub-company's founder is responsible for reporting income on their tax return. Stripe Express issues **1099-K** to the founder when they cross the federal threshold (currently $600 in 2026 under post-ARPA rules; subject to change — Stripe handles tracking).

### 5.2 Sales tax / VAT

Founder is responsible for sales tax on their products (US state sales tax, EU VAT, etc.). Zilla can offer Stripe Tax as a paid feature — recommend exposing it in v1 as a $30/mo upsell once founders cross $5k/mo revenue.

### 5.3 Zilla's own taxes

Zilla's revenue (subscription + 20% application fee + any markup if we add it later) is income to Zilla, taxed normally. Income tax on application fees is straightforward (income at receipt). Income tax on subscriptions is straightforward.

The ad-credit balance is **NOT** Zilla revenue — it's a liability owed back to the founder until used. Recognize as revenue (or pass-through cost) only when ads actually run.

### 5.4 Sales tax on Zilla services

Zilla charges (subscription, application fee) may be subject to state sales tax depending on state and product characterization. Most states do not tax SaaS, but a few (e.g., NY, WA, TX, CT) do for some products. Stripe Tax can collect state sales tax on Zilla's behalf. Get a tax accountant's opinion before scaling subscription revenue past $250k ARR.

## 6. Data Privacy

### 6.1 What lives where

| Data | System of record | Who controls |
|------|------------------|--------------|
| Founder identity, payment instrument | Stripe | Stripe (controller) + Zilla (processor) |
| End-customer card data | Stripe | Stripe (PCI scope on Stripe, not Zilla) |
| End-customer email/billing data | Stripe + Zilla (`revenue_transactions.customer_email`) | Sub-company is controller; Zilla is processor |
| Ad-network campaign content | Zilla | Zilla |
| Ad-performance data | Zilla + ad networks | Zilla (controller of own copy) |
| Agent-generated creative | Zilla | Zilla |
| Conversion / pixel events | Zilla + ad networks (CAPI) | Sub-company controller, Zilla processor |

Zilla **does not** store credit-card numbers or other primary payment instruments. PCI scope stays with Stripe.

### 6.2 GDPR / CCPA posture

- Zilla is **controller** for founder data (account info, dashboard usage)
- Zilla is **processor** for end-customer data flowing through agents and pixels — the sub-company's founder is the controller of their customers
- The ToS / DPA needs to set this up explicitly. Use a standard DPA template; don't roll your own.
- Right-to-delete: founder requests delete → soft-delete in Zilla, anonymize end-customer rows, send deletion request to Meta CAPI / TikTok pixel / Google deletion APIs

### 6.3 Data retention

| Data | Retention | Reason |
|------|-----------|--------|
| Financial records (revenue tx, ad-credit tx) | 7 years | Tax / audit |
| Agent action logs | 1 year | Debugging, audit, compliance |
| End-customer data | Per founder request, default 2 years | GDPR / CCPA |
| Ad creative + performance | 2 years | Pattern analysis |
| Webhook event log | 90 days | Operational |

## 7. Tech Provider Status (Meta)

The architecture works fine for tens of sub-companies. At hundreds, Meta will pressure us to register as a **Tech Provider** in their Business Partner program. This involves:

- Meta-led audit of the platform
- Application demonstrating that sub-companies are real businesses with real intent (not synthetic agents)
- Compliance with Meta's tech provider policy

Polsia almost certainly has this. Zilla should plan to:

- Start the relationship with a Meta partner manager **at month 3** (autonomous-business platform pitch, scale ambition, willingness to invest in compliance)
- Apply formally **at month 6**
- Target approval **by month 9**, before crossing 50 active sub-companies under the parent BP

The application process itself takes 2–3 months; without it, Meta can rate-limit, throttle, or pause our parent BP without warning when our sub-account count surges.

Equivalent programs at other networks:

- **TikTok Marketing Partners** — apply by month 6
- **Google Ads Premier Partner** — based on managed spend; not blocking
- **X Ads Partner** — light; not blocking in v1

## 8. ToS Must-Haves

The terms of service must say at least these things plainly:

1. **Zilla is the merchant of record at ad networks; the sub-company is the merchant of record (via Stripe Connect) for product sales.** Two distinct relationships.
2. **Ad accounts under Zilla's parent cannot be transferred out.** Founder graduating must set up their own.
3. **Zilla takes a 20% application fee on every Stripe charge through the connected account.**
4. **Ad credits are pass-through-at-cost; no markup.**
5. **Refund policy** for unspent ad credits, customer refunds, application fee refund window.
6. **Founder is responsible for ad content compliance, customer disputes, sales tax, and refund policy.**
7. **Zilla can terminate sub-companies for policy violations** with prorated ad-credit refund.
8. **Data: Zilla is controller for founder data, processor for end-customer data.** DPA attached.
9. **Disputes / arbitration / governing law** — recommend Delaware corp, JAMS arbitration, Delaware governing law.
10. **Off-boarding flow and 30-day data export window.**

These can be in a plain-language summary at the top with the formal terms below. Do NOT rely on the formal terms alone — the plain-language summary is what most founders read and what regulators will reference if anything goes sideways.

## 9. Insurance

Recommended coverage as we scale:

- **General liability** — basic. <$2M/yr revenue: cheap; required for any commercial real estate.
- **E&O (errors & omissions) / Tech E&O** — covers software-failure claims. Required by some Stripe Connect partners. Get it before launch.
- **Cyber liability** — covers data-breach response. Get it before launch.
- **Crime / fidelity bond** — covers theft / employee fraud on the float. Recommended once float > $250k.
- **D&O** — once we raise institutional capital.

## 10. Open Compliance Questions

1. **Application fee final value — 20% (this doc) or 15% (prior PRD)?** Resolve before ToS lock.
2. **Operate in CA / NY / TX — do we restrict signup until we have state-specific MTL opinions?** Recommend: launch nationally, get MTL opinion before float crosses $250k.
3. **Do we offer a "BYOM (bring your own card)" escape valve for sub-companies?** Architecturally cleaner to refuse — the closed-loop argument depends on it. Recommend NO.
4. **EU launch?** PSD2 + EU VAT + GDPR DPA stack. Recommend US-only in v1; EU is a 6-month follow-on.
5. **USDC top-up path (V2) — what's the legal posture?** Either we're a software platform routing crypto into Stripe Issuing (likely fine), or we're custodying crypto and converting to fiat (probably triggers crypto MTL or BitLicense). Architecture decision needs lawyer review before V2 ships.
6. **Meta Tech Provider relationship — who owns it?** Founder/CEO sponsorship typically required; can't be just a partner manager email.
7. **1099 / W-9 collection from founders for Zilla payments?** Stripe handles 1099-K for sub-company revenue; Zilla doesn't pay founders directly. Probably no separate Zilla 1099 obligation, but verify with tax counsel.
