# Operations Playbook — Zilla Merchant Template

The Day-0, day-to-day, and incident-response runbook for operating Zilla's parent infrastructure across Stripe, Meta, TikTok, Google, and X.

**Audience:** ops / founding team running Zilla in real life.
**Read first:** `ARCHITECTURE.md`, `docs/01-ad-network-setup.md`, `docs/02-payments-and-ledger.md`.
**Pairs with:** `checklists/parent-bootstrap.md`, `checklists/new-sub-company.md`, `checklists/go-no-go.md`.
**Last updated:** 2026-05-04.

---

## 1. Day-0 — Parent Bootstrap

This is what happens once, before any sub-company exists. The detailed step-by-step is in `checklists/parent-bootstrap.md`. Summary here:

| Step | Owner | Time | Output |
|------|-------|------|--------|
| Form Zilla legal entity (Delaware C-corp) | Founder/Counsel | done | EIN, articles, operating agreement |
| Open business bank account (Mercury / Brex / Ramp) | Founder | 1 day | Operating account, corp card |
| Verify domain `zilla.so` at Meta | Ops | 30 min | Domain verified in Business Portfolio |
| Create Meta **Business Portfolio** | Ops | 30 min | BP id, parent admin |
| Complete Meta Business Verification (when prompted) | Ops | 1–14 days | BV passed |
| Create TikTok Business Center | Ops | 30 min | BC id |
| Create Google Ads Manager Account (MCC) | Ops | 30 min | MCC id |
| Create X Ads account | Ops | 1 hour | X Ads account |
| Apply for Google Ads developer token | Ops | 1–7 days | Dev token approved |
| Create Stripe platform account | Founder | 30 min | Platform account active |
| Activate Stripe Connect | Founder | 30 min | Connect enabled in dashboard |
| Generate Meta System User + token | Ops | 15 min | System user token in vault |
| Generate TikTok / Google / X tokens | Ops | 30 min | Tokens in vault |
| Set up Postgres + KMS + middleware | Engineering | days–week | Infra in place to onboard sub-co #1 |
| First end-to-end test in sandbox | Engineering + Ops | 1 day | Sandbox sub-co with real money flow |

After Day-0, Zilla is ready to accept sub-companies. The ad-network parent IDs go into config and never change.

## 2. Per-Sub-Company Onboarding

Every new sub-company runs through the same flow. Detailed checklist in `checklists/new-sub-company.md`. Operational notes:

### 2.1 What's automated vs manual in v1

**Automated (middleware does this):**
- Stripe Connect account creation + Account Link
- Meta child ad account creation under parent BP (Marketing API)
- Meta Page + Pixel creation
- TikTok advertiser + pixel creation under parent BC
- Google child account creation under MCC
- X Ads account creation
- Initial CAPI / pixel install on the sub-company's site

**Manual (ops team handles for now):**
- Reviewing flagged content during onboarding (fraud / policy classifier hits)
- Resolving Meta business-verification holds on the parent (these affect all sub-companies)
- Approving high-risk sub-company categories
- Handling KYC stuck-in-review states with Stripe support

### 2.2 Onboarding SLAs

- Stripe Express KYC complete to ad accounts provisioned: **<30 minutes** (most stages parallelizable)
- All four ad-network children provisioned: **<2 hours** (Meta is slowest; sometimes BV checks block)
- First campaign launchable: **same day**

If any stage blocks > 24h, surface to founder + ops review.

## 3. Daily Operations

### 3.1 Daily checks (15 min, ops or founder)

- Dashboard scan: any sub-companies near balance floor? (auto-pause should already have fired; verify)
- Disputes opened in last 24h? Triage urgent ones.
- Network policy flags overnight? Triage.
- Stripe Connect alerts? (account holds, payout failures)
- Bank account reconciled with prior day's network charges?

### 3.2 Weekly checks (1 hour)

- Ledger drift report — should be $0.00. If non-zero, file an incident.
- Pending-to-settled latency — should be <72h on average per network.
- Per-network spend vs invoiced — flag if drift > 5%.
- Tokens approaching expiry (rotate Meta System User if <14 days left).
- Sub-company status review — any banned, stuck, or quietly broken?

### 3.3 Monthly

- Treasury yield report (float yield)
- Refund / dispute KPIs
- Network policy violation rates per sub-company category
- Tech Provider relationship check-ins (start at month 3)
- Tax review with accountant (sales-tax obligations as we cross state thresholds)

## 4. Incident Response

A non-exhaustive list of what will happen and what to do.

### 4.1 Sub-company gets banned on a network

**Symptom:** ad account, page, pixel become unusable; account-level warning visible in network UI.

**Response:**
1. Auto: middleware detects via poller, sets `ad_network_accounts.status = banned`, pauses campaigns, notifies founder.
2. Investigate: was the violation policy or platform-trust? (Policy = appeal possible. Platform trust = generally final.)
3. Appeal: file with the network within 24h with sub-company creative and business documentation.
4. If appeal fails: try to provision a new child account under the parent. Some networks (Meta) often won't allow this for the same legal entity that was banned.
5. Communicate with founder: dashboard banner + email with options.

**Critical:** isolate the impact. A sub-company ban must not propagate to the parent BP. If we see signs the parent itself is at risk, escalate to Meta partner manager immediately.

### 4.2 Parent BP gets restricted (Meta)

**Symptom:** all sub-companies suddenly can't run ads; "Account restricted" message on parent BP.

**Response:**
1. **Immediate:** all sub-company campaigns auto-paused (because spend reporting fails).
2. Identify the cause: Meta provides a reason in Business Settings → Account Quality. Common reasons: aggregate policy violations across children, business verification expired, unusual ad spend pattern.
3. If business verification: re-submit immediately with current docs.
4. If policy: identify which sub-companies are responsible. Pause them permanently.
5. Escalate to Meta partner manager with full context.
6. Communicate to all founders: "Meta is reviewing Zilla's parent account; ads are paused; we'll update within 24h." Do NOT speculate on cause publicly.

This is the worst-case incident. Pre-empt with conservative onboarding policy classifiers and Tech Provider status (Section 7 in compliance doc).

### 4.3 Stripe payout block on a sub-company

**Symptom:** `account.updated` webhook with payouts disabled; sub-company can still accept charges but can't withdraw.

**Response:**
1. Surface to founder via dashboard banner with action ("Stripe is reviewing your account — provide additional documentation here").
2. Provide direct link to Stripe-hosted documentation upload.
3. SLA: 24h initial founder response; 5–10 business days for Stripe to clear.
4. If Stripe ultimately closes the account: founder must move to a new sub-company connected account; we provide a migration path (data export + new Connect account).

### 4.4 Ledger drift detected

**Symptom:** nightly drift check alarm — materialized `ad_credit_balances.balance_cents` ≠ `SUM(ad_credit_transactions.amount_cents)` for some sub-company.

**Response:**
1. Pause writes for that sub-company's balance (read-only mode).
2. Engineering investigates: most likely cause is a missing or duplicated webhook / poll; rarely an actual logic bug.
3. Reconcile by hand: write corrective `ad_credit_transactions` row with `type=reconciliation`, `source_kind=manual`, with explanatory note in `source_id`.
4. Restore writes.
5. Add monitoring for the specific drift cause.

### 4.5 Network token revoked / expired

**Symptom:** API calls 401 or 403 across all sub-companies for one network.

**Response:**
1. Auto: middleware retries are exhausted; circuit breaker opens; campaigns continue running on the network but middleware can't update or fetch spend.
2. Polling stops, balance safety auto-pauses sub-companies as their pending data ages.
3. Ops: regenerate System User / refresh OAuth in the network's UI; update `network_api_tokens`.
4. Backfill missed polling cycles. Reconcile spend.

### 4.6 Founder requests refund of ad credits

**Symptom:** support ticket or self-serve refund request from dashboard.

**Response:**
1. Validate: top-up was within refund window (default 90 days). Calculate refundable amount = balance - pending.
2. If within Stripe refund window (90 days from PI): refund original `payment_intent`. Stripe takes the processing fee back (net to Zilla = $0 but customer gets full top-up back).
3. If outside Stripe window: manual ACH refund from Zilla's bank, write a reversing ledger entry.
4. Decrement `ad_credit_balances.balance_cents` by refund amount.
5. Communicate with founder.

### 4.7 Customer chargeback on a sub-company

**Symptom:** `charge.dispute.created` webhook.

**Response:**
1. Auto: pause sub-company (precaution), notify founder via email + dashboard.
2. Founder uploads evidence via dashboard within 7 days.
3. Submit evidence to Stripe via API.
4. Outcome arrives via `charge.dispute.closed` (1–60 days depending on card network).
5. If lost: chargeback amount + dispute fee comes off the sub-company's connected account (Stripe handles this). Application fee handling per ToS (default: keep the fee for non-customer-fault disputes; refund for customer-refund-equivalent cases).

## 5. Scaling Operations

The architecture in this repo is designed for **0 → 100 sub-companies under one Zilla parent**. Key thresholds and what to do at each:

### 5.1 At 25 active sub-companies

- Apply for **Meta Tech Provider** status (don't wait until pressed).
- Audit per-sub-company creative quality — patterns of policy flags become visible at this scale.
- Dedicated ops headcount for ban / appeal handling becomes worth it.

### 5.2 At 50 active sub-companies

- Tech Provider status approved (ideally) or in late-stage review.
- Move to per-segment risk tiers — high-risk verticals (financial advice, supplements) on separate sub-parent BP if Meta requires.
- Treasury sweep daily (vs. manual reconciliation) — more float, more state-specific MTL questions to revisit.

### 5.3 At 100 active sub-companies

- Multiple Business Portfolios under separate Zilla legal entities (high-risk vs. low-risk verticals split). This is mostly to limit blast-radius of a single parent ban.
- Build dedicated sub-tenant rate-limiting on tokens (Meta's per-token rate limit becomes the bottleneck).
- Consider applying for **TikTok Marketing Partner** and **Google Premier Partner** at this scale.

### 5.4 Beyond 100

This repo's architecture stops being sufficient. Plan for:

- Multi-region Stripe (EU, UK, AU expansion) — additional Stripe platforms per region.
- Multi-currency ledger (`currency` field already in schema).
- USDC / stablecoin top-up path (V2; see `docs/02-payments-and-ledger.md` § stablecoin path).
- Spin out a dedicated risk / compliance team.

## 6. Personnel Required to Operate

This is what an actual person-team-shape looks like, by phase:

**Phase 1 (0–10 sub-companies):** founder + 1 engineer + 1 part-time ops/legal. Founder handles ops manually.

**Phase 2 (10–50):** add a dedicated ops person (handle bans, refunds, KYC issues, partner manager relationships). Engineering: 2–3 people on payment + ad-network infra.

**Phase 3 (50–200):** ops grows to 2–3 (one Meta partner relationship, one ops, one finance/treasury). Engineering: 4–6 on infra. Hire compliance / legal counsel on retainer.

**Phase 4 (200+):** dedicated compliance team, partner relationship management as its own function, separate FP&A for treasury and float yield. Multi-region engineering split.

## 7. Tools / Vendors

The recommended stack to operate the architecture:

| Need | Pick (recommended) | Why |
|------|---------------------|-----|
| Banking + corp card | Mercury or Brex | Modern API, webhooks for settlement reconciliation, decent yield |
| Treasury yield | Mercury Treasury / Brex Cash | T-bill-equivalent yield on float |
| Cloud | Vercel (frontend) + AWS or Render (backend) | Flexible per workload |
| Database | RDS Postgres or Neon | Managed, point-in-time recovery |
| Secrets | AWS KMS / GCP KMS | Encryption-at-rest for tokens |
| Error tracking | Sentry | Per-service signals |
| Logging / metrics | Datadog or Grafana Cloud | Single pane for webhooks + polling + ledger |
| On-call | PagerDuty or Linear OnCall | Especially for balance-floor pauses + ledger drift |
| Helpdesk | Linear Helpdesk or Pylon | Founder support tickets |
| Tax / 1099 | Stripe (built-in) | 1099-K for sub-companies |
| Sales tax | Stripe Tax | Add as upsell to founders crossing thresholds |
| KYC / KYB | Stripe (built-in) | Already in Connect Express |
| Legal | Cooley / Wilson Sonsini for incorporation; Davis Wright Tremaine or similar for MTL opinion | |
| Insurance | Vouch or similar tech-startup carrier | E&O + cyber bundled |

## 8. Communication Templates (Common Founder-Facing Situations)

Keep these in Linear / a docs site as canonical and edit centrally; no individual support agent should compose from scratch.

- "Stripe needs more info before payouts" — link to Stripe upload, SLA expectation
- "Meta paused your ad account — here's what we're doing" — investigation status, when to hear back
- "Your balance hit the safety floor — top up to resume ads" — one-click top-up CTA
- "Your sub-company is being terminated for policy violation" — specific category, refund amount, off-board flow
- "Welcome — your Zilla sub-company is live" — first-week activation
- "Weekly performance digest" — automated; review template monthly

## 9. Audit Trails

What we keep, where, for how long:

| Trail | Storage | Retention |
|-------|---------|-----------|
| Every middleware action | Postgres `agent_action_log` (or equivalent) + structured log | 1 year hot, 7 year cold |
| Every webhook receipt | DB row + log | 90 days hot, 1 year cold |
| Every Stripe call | Stripe dashboard + our log | Forever (Stripe) |
| Every ad-network call | Per-network dashboards + our log | 90 days local, network does longer |
| Ledger | Postgres `ad_credit_transactions` + `revenue_transactions` (append-only) | 7 years (tax) |
| KYC events | Stripe + our `account.updated` webhook log | 7 years |
| Disputes & refunds | Stripe + DB | 7 years |

Backups: nightly Postgres snapshot (PITR enabled). Off-region replica recommended once revenue > $250k/yr. Practice restore quarterly.

## 10. The "Don't Do This" List

- **Don't** mark up ad spend. Pass-through-at-cost is the trust mechanism. (Networks also explicitly prohibit reselling.)
- **Don't** allow ad credits to be transferred between sub-companies, withdrawn as cash, or used outside Zilla — this breaks the closed-loop MTL posture.
- **Don't** let the AI agent call Stripe or ad networks directly. Always go through middleware.
- **Don't** mix the platform Stripe account and connected sub-accounts mentally; keep them rigorously separate in code, dashboards, and finance.
- **Don't** skip the 5-minute Stripe webhook timestamp check (replay protection).
- **Don't** log decrypted tokens, ever.
- **Don't** ship USDC top-ups without legal review (V2; see compliance doc § 1.3).
- **Don't** scale past 25 active sub-companies without starting the Meta Tech Provider conversation.
- **Don't** rely on the materialized balance — always reconcile against the transactions ledger nightly.
- **Don't** delete `ad_credit_transactions` or `revenue_transactions` rows. Append-only forever.
