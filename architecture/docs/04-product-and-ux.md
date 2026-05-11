# Product & UX — Zilla Merchant Template

What a founder using Zilla actually experiences. Written for whoever builds the founder dashboard, writes the support docs, drafts the ToS, or designs onboarding.

**Audience:** product, design, content/support.
**Read first:** `ARCHITECTURE.md`.
**Last updated:** 2026-05-04.

---

## 1. The Core UX Promise

> "Describe a business. Zilla launches it. Payments work, ads run, and you don't touch Meta, TikTok, Google, or Stripe."

Every UX decision should hold this promise. The moment a founder is asked to log into Meta Business Suite, configure a pixel, talk to Stripe support, or understand what an MCC is — we've broken the promise.

The corollary: founders see receipts, not infrastructure. They see "$100 of ad credits spent today" not "Meta charged ad_account_id 906233412 $44.21 and TikTok charged advertiser_id 7290139 $55.79." Under the hood the latter is true; on screen it's the former.

## 2. Onboarding (First 10 Minutes)

The founder signs up, picks a sub-company name, and goes through four steps. Time-to-first-revenue should be <15 minutes for a simple sub-company.

### Step 1 — Tell us about the business (60 seconds)

- Name
- One-sentence description ("a Notion template store for product managers")
- Target customer (free text or chips)
- Pricing model (subscription / one-time / freemium)
- Country (US default in v1)

This screen also feeds the AI agent. The same fields seed the agent's first creative direction.

### Step 2 — Connect to get paid (3 minutes)

A single CTA: **"Connect to Stripe"**. Redirects to Stripe Express onboarding (Stripe-hosted, white-labeled with Zilla branding where Stripe allows).

The founder enters: legal name, DOB, business address, bank for payouts, EIN if they have one. Stripe handles ID verification.

When done, founder is back on Zilla. Status: `Payments live`.

**UX rule:** never re-collect data Stripe already has. Pull from `account.updated` webhook.

### Step 3 — Authorize the ads (1 minute)

A single screen with copy like:

> Zilla will create ad accounts for you on Meta, TikTok, Google, and X. You don't need accounts of your own. We'll be the merchant of record at each network — your card pays Zilla, Zilla pays the networks.

A single Confirm button. On confirm, Zilla provisions the assets in the background (under Zilla's parent BP/BC/MCC/X). Takes 5–30 minutes; the founder doesn't wait — they continue to Step 4.

If verification on a specific network is delayed (Meta business verification etc.), the dashboard surfaces the partial state ("Meta and Google ready; TikTok still verifying — usually 24h").

### Step 4 — Add your first ad budget (2 minutes)

Header: **"Top up your ad credits."**

Pre-set chips: $100, $250, $500, $1,000. Custom amount field.

Below, plain copy:

> $100 of ad credits = $100 of actual ad spend at Meta/TikTok/Google/X. We don't mark this up. Zilla makes its money on a 20% fee from your sales, not from your ads.

Founder pays via Stripe (saved card from Step 2 or new card). Confirmation screen shows balance live in dashboard.

After Step 4, the agent is unblocked. From the founder's POV, they have a working business with payments + ads, and they did not touch any ad-network UI.

## 3. The Founder Dashboard

A single page with three modules. Resist the temptation to add tabs or settings sub-pages in v1 — every screen added is a friction point.

### 3.1 Revenue module

Top-line numbers: this week, this month, all-time. Powered by `revenue_transactions`.

Per-charge row format:

```
2026-05-06   buyer@example.com    $100.00 gross
                                   −$3.20 Stripe processing
                                   −$20.00 Zilla fee (20%)
                                   = $76.80 to your bank
```

One number per row, fully transparent. Show the full breakdown so founders never have to ask "where did my money go."

Below, a simple line chart of weekly revenue.

### 3.2 Ad Credits module

Three numbers: **Available balance**, **Pending today**, **Top up** button.

Today's spend across all networks:

```
Meta     $44.21
TikTok   $30.10
Google   $12.50
X        $0
─────────
Total    $86.81 spent today
```

Rolling 30-day chart of daily spend.

Top-up flow: chip selector (preset amounts) + custom field. Stripe Element inline for new card; one-click for saved card. Confirmation back to dashboard.

### 3.3 Performance module

Per-network campaign performance. Conversions, ROAS, top creatives.

Plus an **Agent feed** — a chronological log of what the agent has done:

> 06:14 — Paused "Notion-Templates-AdSet-3" because CTR dropped 30% over 24h
> 09:02 — Launched 3 new creatives based on top performers from last week
> 14:47 — Increased TikTok daily budget on "Spark-CreatorBoost-1" to $30 — strong ROAS

Every action visible. This is the trust mechanism.

### 3.4 The emergency brake

Top-right corner, always accessible: **"Pause agent"** toggle.

Pausing the agent stops all autonomous actions; campaigns continue running on the networks but the agent will not modify them. The founder can also pause individual campaigns from the Performance module.

## 4. What the Founder Pays — Three Line Items

Every Zilla statement separates three line items cleanly. **Never bundle.**

1. **Zilla subscription** — recurring monthly (e.g., $99/mo). Platform access, agent operations, infra. Charged to the founder's saved card on a monthly cycle.
2. **Ad credit top-ups** — founder-initiated, prepaid balance. Goes 1:1 to actual ad spend at the networks. Charged when the founder clicks Top up.
3. **Application fee on revenue** — 20% of every Stripe charge through the sub-company's connected account. Deducted automatically by Stripe Connect. Shown on every revenue line.

The dashboard says explicitly:

> $100 of ad credits = $100 of actual ad spend.
> We don't mark up your ads. We make money on a 20% fee from your sales.

This honesty is a trust-builder, matches Polsia, and avoids the compliance risk of ad reselling (Meta hates that).

## 5. Founder Responsibilities (Make Explicit in ToS)

- **Ad content compliance.** The founder is responsible for the legality of their offer. If the agent generates an ad that violates a network's policy, the founder bears the consequence — warnings stay scoped to their sub-company, not Zilla-wide, but the network may still ban that sub-company.
- **Customer disputes.** The founder responds to chargebacks. Zilla provides tools (dispute UI, evidence upload) but is not the merchant of the underlying product.
- **Tax.** The founder is responsible for income tax on their earnings. Stripe issues 1099-K. Sales tax: founder is responsible (Stripe Tax can be enabled if needed).
- **Refund policy.** The founder sets the refund policy and Zilla enforces it via dashboard and ToS.
- **Account hygiene.** If the founder's ad creative gets the sub-company banned on a network, Zilla provisions a new account where possible but does not guarantee it.

## 6. Zilla Responsibilities (Equally Explicit)

- **Provisioning and maintaining ad infrastructure** — parent accounts, child accounts, pixels, API tokens, server-side tracking.
- **Billing relationship with networks** — Zilla is the merchant of record at Meta, TikTok, Google, X.
- **Stripe integration** — for revenue (Connect Express) and for ad-credit + subscription funding.
- **Agent operations** — the AI brain that creates campaigns, optimizes, and reports.
- **Uptime and security** — dashboard, agent, API integrations.
- **Funds in escrow** — ad-credit balance is held in trust until used; refundable per policy (Section 7).

## 7. Refund Policy (Recommended Defaults)

| Refund type | Default policy | Why |
|-------------|----------------|-----|
| Unspent ad credits | Refundable up to 90 days from top-up, minus pending charges | Trust-builder; matches industry norm |
| Stripe processing fees on revenue refunds | Stripe keeps fees on refunds (their policy) | Out of our control |
| Application fee (20%) on revenue refunds | Refunded if customer-refund happens within 30 days; kept after | Avoids gaming ("get refund 6 months later, claw back our fee") |
| Zilla subscription | Pro-rated refund on cancellation, no refund for past months | Standard SaaS |

Document all four in the ToS. Show in plain language at top-up time.

## 8. Off-boarding (Founder Leaves Zilla)

Two paths. Both should be self-serve from the dashboard.

### Soft leave (most common)

The founder pauses their sub-company. Ads stop. Stripe payments stop. Account stays in DB. Can resume later.

UX: a single Pause sub-company button. Confirmation modal explains what happens. One-click resume.

### Hard leave (graduation)

The founder wants to take their business off Zilla and run it independently. Zilla provides:

- Export of customer data (CSV)
- Export of transaction history (CSV)
- 30-day window to migrate to their own Stripe account (Stripe Connect Standard graduation, where Stripe permits)
- Refund of any unspent ad-credit balance (minus any pending charges)
- Permanent revocation of Zilla's tokens on Meta/TikTok/Google/X for their accounts

**Critical to document up front:** ad accounts under Zilla's parent BP/BC/MCC **cannot** be transferred out. The founder has to set up their own parent accounts elsewhere if they want to keep running ads. Same is true of Polsia. Put this in the ToS plain-language summary at sign-up.

UX: Off-board button → modal that lists what they get, what they lose, refund amount → confirm + email confirmation → 30-day countdown clock visible in dashboard.

## 9. Support and Disputes

Founder hits **Help** → ticket goes to Zilla support.

| Ticket type | SLA | Channel |
|-------------|-----|---------|
| Money issue (refund, dispute, payout) | 24 hours | Email + dashboard reply |
| Agent behavior question | 48 hours | Async, dashboard feed |
| Account lockout / KYC stuck | 24 hours | Email + escalation to Stripe support |
| Network ban / appeals | 24 hours initial response, days-weeks resolution | Dashboard + email |

Critical edge case: the agent does something the founder doesn't like. The Pause agent toggle (Section 3.4) is the founder's emergency brake. They can pause agent actions or specific campaigns from the dashboard at any time without contacting support.

## 10. Empty States and First-Run

The dashboard before the agent has done anything should not be a wall of zeros. Use empty states that orient the founder:

- **Revenue:** "Your first sale will appear here. Most sub-companies see their first sale within 7 days."
- **Ad Credits:** "Your balance is loaded. The agent will start running ads in the next 30 minutes."
- **Performance:** "The agent is launching campaigns. Performance data will appear within 24 hours."

After the agent's first action: replace empty states with real data + a one-time tour of the agent feed.

## 11. Notification UX

Email triggers (recommended defaults):

- Payments KYC complete → "You're ready to accept payments"
- Ad accounts provisioned → "Your ad accounts are live"
- First sale → "$X arrived in your account"
- Balance low ($50 floor) → "Top up to keep ads running"
- Agent paused all campaigns (balance hit floor) → "Action needed: top up to resume"
- Network policy warning on a sub-company → "Heads up — Meta flagged X"
- Sub-company banned on a network → "Action needed: a network paused your account"
- Weekly performance digest → "This week: $X revenue, $Y ad spend, ROAS Z"

In-dashboard alerts: same triggers as email, except the weekly digest. Always provide a mute option per category.

## 12. Mobile Considerations

V1 is desktop-primary. The dashboard should be responsive enough to read on mobile (key numbers visible) but the agent-feed scroll and the top-up flow can be desktop-first. Don't over-invest in mobile until founder behavior demands it.

Push notifications: not in v1. Email + in-dashboard banners are enough.

## 13. Open Product Decisions

1. **Minimum ad credit top-up amount?** $100 default; consider $25 for trial users to lower the activation barrier.
2. **Multi-sub-company per founder?** Architecture supports it (one founder → many sub-companies). UX: tab-switcher in the top nav. Build now or later? Recommend later — single-sub-co flow is enough for v1.
3. **Agent autonomy levels?** Currently binary (on / paused). Consider three modes: "Full autonomy" / "Approve before launch" / "Paused." Approve-before-launch reduces founder anxiety in early days. Recommend adding by month 2.
4. **Subscription tier vs per-action pricing?** Flat monthly is simplest. Per-action ("$0.50 per agent action") is more aligned but harder to explain. Stick with flat in v1.
5. **Public sub-company directory?** Polsia surfaces some sub-companies as case studies. Useful for marketing but creates support load. Skip in v1, revisit at month 6.
6. **In-dashboard chat with the agent?** Powerful, lets the founder steer ("focus on Notion users, deprioritize freelancers"). High-value but complex. Recommend MVP: a free-text "Notes for the agent" field that the agent reads on each action cycle.
