# Go / No-Go Checklist

The pre-launch gate before any sub-company goes live with **real money** (real cards, real ad spend, real revenue). Run this before flipping the switch from sandbox/staging to production.

**Owner:** founder + lead engineer + ops/legal.
**Timing:** complete the parent bootstrap (`checklists/parent-bootstrap.md`) first, then this gate, then onboard sub-company #1.

If any line below is unchecked, **do not launch.** Each one represents a real failure mode we've thought through.

---

## 1. Stripe / Payments

- [ ] Platform account corporate KYB complete; charges and payouts enabled
- [ ] Connect activated; Express is the default account type
- [ ] Live API keys in production secrets manager (NOT in code, NOT in Vercel env via CLI without rotation)
- [ ] Webhook endpoint live at `https://api.zilla.so/webhooks/stripe` and signature verification enforced
- [ ] All required webhook events subscribed (per `docs/03-engineering-spec.md` § 3.1)
- [ ] Webhook idempotency tested (replay event → no duplicate row)
- [ ] End-to-end Connect flow tested in test mode: account creation → KYC → destination charge with application_fee → refund flow → dispute flow
- [ ] Stripe Tax decision made (enable / not enable for v1)
- [ ] Refund policy documented in ToS (matches `docs/04-product-and-ux.md` § 7)

## 2. Ad Networks

### Meta
- [ ] Business Portfolio created, payment method on file
- [ ] Domain `zilla.so` verified (DNS TXT)
- [ ] Aggregated Event Measurement configured
- [ ] System User token generated with required scopes; encrypted at rest
- [ ] Marketing API app created; Standard Access applied for (Advanced if available)
- [ ] Meta partner manager contact identified (start relationship by month 3 latest)
- [ ] Ad-account creation tested under parent BP

### TikTok
- [ ] Business Center created, identity verified, payment method on file
- [ ] Marketing API access approved
- [ ] Long-lived advertiser-scoped token generated; encrypted at rest
- [ ] Advertiser creation tested under parent BC

### Google
- [ ] MCC created, billing enabled
- [ ] **Developer token approved** (basic level minimum)
- [ ] OAuth2 refresh token generated; encrypted at rest
- [ ] Sub-account creation tested under parent MCC

### X (optional in v1 — skip if deferred)
- [ ] Ads account created, billing enabled
- [ ] Ads API subscription paid
- [ ] OAuth1.0a tokens generated

## 3. Engineering / Infrastructure

- [ ] Postgres schema deployed (`schema/postgres-init.sql` ran clean)
- [ ] PITR enabled, off-region replica configured (or planned within 30 days post-launch)
- [ ] KMS configured; all `network_api_tokens` encrypted at rest
- [ ] Middleware deployed, env vars set, healthcheck passing
- [ ] Stripe webhook handler tested with `stripe trigger` events
- [ ] Ad-network polling cron deployed for at least Meta + TikTok + Google (X optional)
- [ ] `balance_safety_check` cron running every 15 min
- [ ] `balance_drift_check` cron running nightly with alerting
- [ ] Error tracking (Sentry) catching and routing
- [ ] Metrics dashboards live (per `docs/03-engineering-spec.md` § 10)
- [ ] On-call rotation established (PagerDuty); runbook references `docs/06-operations-playbook.md`
- [ ] Load tests passed at simulated 100 sub-co state

## 4. AI Agent

- [ ] Agent service deployed
- [ ] Agent has its own service token, NOT direct network tokens
- [ ] Every agent action goes through middleware; no direct network API calls verified by access logs
- [ ] Per-action and per-sub-company rate limits configured
- [ ] Agent rejection paths tested (balance floor, cap exceeded, rate limit) — agent surfaces error to dashboard correctly
- [ ] Pre-launch policy classifier tested on creative; high-risk creative blocked

## 5. Founder UX

- [ ] Onboarding flow live at `zilla.so/start` (or wherever)
- [ ] Stripe Express redirect-and-return tested with real and refresh URLs
- [ ] Dashboard live: Revenue, Ad Credits, Performance modules render correctly with seeded data
- [ ] Top-up flow tested end-to-end (test mode)
- [ ] Pause-agent toggle works and pauses agent across all networks
- [ ] Email triggers configured (welcome, balance low, balance hit floor, weekly digest)
- [ ] Helpdesk live; SLAs documented

## 6. Compliance & Legal

- [ ] ToS published at `zilla.so/terms` covering items in `docs/05-compliance.md` § 8
- [ ] Privacy policy published at `zilla.so/privacy` (controller / processor language correct)
- [ ] DPA available for founders who need one
- [ ] Refund policy in ToS matches dashboard UX
- [ ] MTL posture documented; below trigger thresholds (< $250k float, no movement of credits between sub-cos, etc.)
- [ ] Stripe Tax / sales tax obligations evaluated (defer to post-launch if revenue-gated)
- [ ] Data retention policy documented and implemented (where reasonable; can mature post-launch)
- [ ] Insurance: at minimum E&O / Tech E&O and Cyber Liability bound
- [ ] Incorporated in Delaware (or chosen jurisdiction); EIN active

## 7. Treasury / Finance

- [ ] Operating bank account opened (Mercury / Brex / Ramp)
- [ ] Corp card issued and on file at every ad network
- [ ] Bank webhook (or daily import job) reconciling network charges to ledger
- [ ] Treasury yield setup (T-bill product or similar) — optional but recommended
- [ ] Accounting books open; ledger ↔ accounting reconciliation process defined
- [ ] First-month financial close dry-run completed

## 8. Operations / Support

- [ ] Helpdesk live (Linear / Pylon / equivalent)
- [ ] Support SLAs published internally and externally
- [ ] Communication templates written for common situations (Stripe KYC stuck, Meta paused, balance floor hit, etc.) — see `docs/06-operations-playbook.md` § 8
- [ ] Incident runbook published; on-call knows how to invoke it
- [ ] Status page configured (statuspage.io or simple Vercel page)

## 9. Pilot

- [ ] At least 1 internal sub-company onboarded end-to-end through prod (use Zilla itself as the first sub-co — eat your own dog food)
- [ ] Pilot ran for ≥ 7 days with real $5–$50 daily ad spend
- [ ] Reconciliation matched: bank charges = ledger pending → settled
- [ ] At least 1 real revenue charge processed; application fee correctly split
- [ ] At least 1 simulated incident (token revocation, balance floor, dispute) handled per runbook

## 10. Decisions Locked Before Launch

- [ ] Application fee % final (resolve 15% vs 20% open question)
- [ ] Minimum ad credit top-up amount ($100 default vs trial-friendly smaller)
- [ ] BYOM (bring your own card) — confirmed NO for v1
- [ ] Subscription pricing locked
- [ ] Refund window for unspent ad credits (90 days recommended)
- [ ] Application fee refund policy (30-day rule recommended)
- [ ] Stripe Connect Standard graduation policy and revenue threshold

---

## Sign-Off

When every line above is checked:

- [ ] **Founder** signs off
- [ ] **Lead engineer** signs off
- [ ] **Ops** signs off
- [ ] **Counsel** signs off (review of ToS, privacy, MTL posture)

Then — and only then — flip the switch.

After launch, the operational cadence in `docs/06-operations-playbook.md` § 3 takes over.
