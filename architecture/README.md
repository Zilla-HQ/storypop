# Zilla Platform Architecture

The complete architecture, engineering spec, product UX, and operations playbook for the Zilla **platform** — the layer that sits underneath every merchant-template instance.

**This subfolder lives inside `Zilla-HQ/merchant-template`** because the merchant template repo and the platform spec evolve together: every merchant-template fork connects to the platform infrastructure described here (Stripe Connect Express, parent BP/BC/MCC ad accounts, ad-credit ledger, agent rate-limit middleware, etc.). If you only read the root `README.md`, you'll understand what *one* merchant looks like. If you read this subfolder, you'll understand the platform that runs *all* of them.

If you're new, read the docs in order. Each one assumes the previous.

---

## How this relates to the rest of the repo

| Layer | Where it lives | What it is |
|-------|----------------|------------|
| **Platform** (Zilla HQ) | This `architecture/` subfolder | Spec for parent ad-network accounts, Stripe Connect platform, ad-credit ledger, agent middleware, compliance posture, ops playbook |
| **Merchant instance** | Repo root (everything outside `architecture/`) | The Next.js + Inngest app that runs *one* merchant. Forked per vertical. Connects to the platform via the patterns described here. |
| **Merchant-side ad runbooks** | Root `META_ADS.md`, `GOOGLE_ADS.md`, `GOOGLE_ADS_OPERATOR.md` | How a single merchant operates its child ad account. Pair with `architecture/docs/01-ad-network-setup.md` for the parent-side provisioning. |
| **Merchant-side platform setup** | Root `ZILLA_HQ_SETUP.md`, `SETUP.md` | How a single merchant gets stood up. Pair with `architecture/checklists/new-sub-company.md` for the platform-side automation. |

---

## Subfolder structure

```
architecture/
├── README.md                  ← you are here
├── ARCHITECTURE.md            ← single-page system overview, read this second
├── docs/
│   ├── 01-ad-network-setup.md      ← parent/child accounts on Meta/TikTok/Google/X
│   ├── 01a-meta-sub-company-replication.md ← Polsia replication, engineer + operator split
│   ├── 02-payments-and-ledger.md   ← Stripe Connect + ad-credit ledger
│   ├── 03-engineering-spec.md      ← schema, webhooks, integrations, agent limits
│   ├── 04-product-and-ux.md        ← founder onboarding, dashboard, billing UX
│   ├── 05-compliance.md            ← money-transmitter posture, KYC, tax, chargebacks
│   └── 06-operations-playbook.md   ← bootstrap, sub-co onboarding, ban response, scaling
├── schema/
│   └── postgres-init.sql      ← runnable Postgres DDL extracted from 03-engineering-spec
└── checklists/
    ├── parent-bootstrap.md    ← Day-0: stand up Zilla's parent accounts
    ├── new-sub-company.md     ← Per-sub-company onboarding checklist
    └── go-no-go.md            ← Pre-launch gate before any sub-co goes live
```

---

## Quick start by role

**Engineer building zilla-v2** → start with `ARCHITECTURE.md`, then `docs/03-engineering-spec.md`, then run `schema/postgres-init.sql`.

**Engineer working on the merchant template (root of this repo)** → skim `ARCHITECTURE.md` for context on what your merchant connects to, then look at `docs/01-ad-network-setup.md` (parent side of the Meta/Google integrations you're already using), `docs/01a-meta-sub-company-replication.md` (the exact 14-step Polsia replication procedure for Meta — engineer + operator split), and `docs/02-payments-and-ledger.md` (the Stripe Connect application_fee model the platform uses on top of merchant Stripe Checkout).

**Product / design** → `ARCHITECTURE.md`, then `docs/04-product-and-ux.md`.

**Operations / GTM** → `checklists/parent-bootstrap.md` first (do this once for Zilla), then `checklists/new-sub-company.md` for each sub-company.

**Legal / finance** → `docs/05-compliance.md`.

**Anyone trying to understand the strategy** → `ARCHITECTURE.md` is the single best 10-minute read.

---

## What this pattern is copied from

This architecture is modeled on [Polsia](https://polsia.com) — the AI-company-creation platform that hit $6.2M ARR in under 90 days operating ~1,000+ AI-run sub-businesses under a single parent infrastructure. The model:

- Polsia owns one Business Portfolio at Meta, one Business Center at TikTok, one Manager Account at Google
- Each sub-company gets its own child ad account, page, pixel, identity inside the parent
- Polsia is the merchant of record at the ad networks — its corporate card pays Meta, founder pre-funds a credit balance with Polsia
- Polsia uses Stripe Connect to take 20% application fees on sub-company revenue
- Sub-companies never have to set up their own Business Portfolio, KYC themselves with Stripe, or apply for ad accounts

We're building the same architecture for Zilla, with one strategic addition: ad spend flowing through Zilla's payment rails creates the foundation for a stablecoin-rail demand sink in V2 (route the Visa interchange savings as Zilla economics).

For the full strategic context, see the parent project research files outside this repo.

---

## Status

- **Architecture v1**: locked 2026-05-04. See `ARCHITECTURE.md`.
- **Engineering spec v1**: locked 2026-05-04. See `docs/03-engineering-spec.md`.
- **Open decisions**: application fee % (15% vs 20%), minimum top-up amount, BYOM escape valve. See `ARCHITECTURE.md` § Open Questions.

---

## How to update this subfolder

When the platform architecture changes:
1. Update the canonical doc(s) in `architecture/docs/`
2. Update `architecture/ARCHITECTURE.md` if the change is system-level
3. Update `architecture/schema/postgres-init.sql` if the data model changes
4. Note the change at the top of the affected file with date and decision rationale
5. Open a PR — this subfolder is the source of truth for the platform layer. If a Notion/Slack discussion contradicts what's here, this wins until updated.
