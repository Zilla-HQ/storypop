-- Zilla Merchant Template — Postgres DDL
-- Source of truth: docs/03-engineering-spec.md § 2 (Data Model)
-- Last updated: 2026-05-04
--
-- Conventions:
--   - All amounts in cents (BIGINT). Never floats.
--   - All timestamps in UTC (TIMESTAMPTZ).
--   - Soft deletes via status field; rows are not removed.
--   - ad_credit_transactions and revenue_transactions are append-only — no UPDATE, no DELETE.
--   - ad_credit_balances is a materialized cache; truth = SUM(ad_credit_transactions). Reconcile nightly.
--
-- Run: psql $DATABASE_URL -f schema/postgres-init.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- Users (founders authenticated to Zilla)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,                 -- user_xyz789
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- Sub-companies (one row per business launched on Zilla)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_companies (
  id                          TEXT PRIMARY KEY,                 -- subc_abc123
  founder_user_id             TEXT NOT NULL REFERENCES users(id),
  name                        TEXT NOT NULL,
  slug                        TEXT UNIQUE NOT NULL,             -- sitegrid (used in *.zilla.so subdomain)
  domain                      TEXT,                             -- sitegrid.com if independent
  description                 TEXT,                             -- short business description
  category                    TEXT,                             -- saas | ecommerce | content | services | ...
  stripe_connect_account_id   TEXT UNIQUE,                      -- acct_xxx
  stripe_customer_id          TEXT,                             -- cus_yyyy (founder's saved card on platform)
  status                      TEXT NOT NULL,                    -- created | onboarding | active | paused | offboarded | terminated
  daily_spend_cap_cents       BIGINT NOT NULL DEFAULT 50000,    -- $500 default per-sub-co daily ad cap
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_companies_founder ON sub_companies (founder_user_id);
CREATE INDEX IF NOT EXISTS idx_sub_companies_status ON sub_companies (status);

-- ─────────────────────────────────────────────────────────────────
-- Ad-network accounts (one row per (sub-company, network) pair)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_network_accounts (
  id                          TEXT PRIMARY KEY,                 -- ana_xxx
  sub_company_id              TEXT NOT NULL REFERENCES sub_companies(id),
  network                     TEXT NOT NULL,                    -- meta | tiktok | google | x
  external_account_id         TEXT NOT NULL,                    -- ad_account_id / advertiser_id / customer_id / X account id
  external_pixel_id           TEXT,                             -- network's pixel/tag id where applicable
  fb_page_id                  TEXT,                             -- Meta-specific
  ig_account_id               TEXT,                             -- Meta-specific
  ga4_property_id             TEXT,                             -- Google-specific
  status                      TEXT NOT NULL,                    -- created | verified | active | paused | banned
  daily_spend_cap_cents       BIGINT NOT NULL DEFAULT 5000,     -- $50 default per-network cap
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_company_id, network)
);
CREATE INDEX IF NOT EXISTS idx_ana_network ON ad_network_accounts (network, status);

-- ─────────────────────────────────────────────────────────────────
-- Ad-credit balances (materialized cache; truth = sum of transactions)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_credit_balances (
  sub_company_id              TEXT PRIMARY KEY REFERENCES sub_companies(id),
  balance_cents               BIGINT NOT NULL DEFAULT 0,        -- available + pending; total
  pending_cents               BIGINT NOT NULL DEFAULT 0,        -- pending deductions not yet settled
  currency                    CHAR(3) NOT NULL DEFAULT 'USD',
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (balance_cents >= 0),
  CHECK (pending_cents >= 0)
);

-- ─────────────────────────────────────────────────────────────────
-- Ad-credit transactions (append-only ledger of every credit movement)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_credit_transactions (
  id                          BIGSERIAL PRIMARY KEY,
  sub_company_id              TEXT NOT NULL REFERENCES sub_companies(id),
  type                        TEXT NOT NULL,                    -- topup | deduction | refund | reconciliation
  amount_cents                BIGINT NOT NULL,                  -- positive for topup/refund, negative for deduction
  network                     TEXT,                             -- meta | tiktok | google | x | NULL for top-ups
  status                      TEXT NOT NULL,                    -- pending | settled | reversed
  source_kind                 TEXT NOT NULL,                    -- stripe | meta_poll | tiktok_poll | google_poll | x_poll | manual | usdc_onchain (V2)
  source_id                   TEXT,                             -- pi_xxx | ch_xxx | external invoice id | poller cursor
  spend_period_start          DATE,                             -- for deductions: which day of network spend
  spend_period_end            DATE,
  notes                       TEXT,                             -- free-text for reconciliation transactions
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at                  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_act_sub_co_created ON ad_credit_transactions (sub_company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_act_network_status_period ON ad_credit_transactions (network, status, spend_period_start);
CREATE INDEX IF NOT EXISTS idx_act_source ON ad_credit_transactions (source_kind, source_id);

-- ─────────────────────────────────────────────────────────────────
-- Revenue transactions (Stripe Connect destination charges)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_transactions (
  id                          BIGSERIAL PRIMARY KEY,
  sub_company_id              TEXT NOT NULL REFERENCES sub_companies(id),
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_charge_id            TEXT UNIQUE,
  gross_cents                 BIGINT NOT NULL,
  stripe_fee_cents            BIGINT NOT NULL,
  application_fee_cents       BIGINT NOT NULL,                  -- Zilla's 20% (or current rate)
  net_to_company_cents        BIGINT NOT NULL,
  status                      TEXT NOT NULL,                    -- succeeded | refunded | partially_refunded | disputed | dispute_lost
  customer_email              TEXT,
  customer_country            TEXT,
  refunded_amount_cents       BIGINT NOT NULL DEFAULT 0,
  application_fee_refunded_cents BIGINT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rev_sub_co_created ON revenue_transactions (sub_company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rev_status ON revenue_transactions (status);

-- ─────────────────────────────────────────────────────────────────
-- Ad campaigns (mirror of network-side state for caps + analytics)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                          TEXT PRIMARY KEY,                 -- camp_xxx
  sub_company_id              TEXT NOT NULL REFERENCES sub_companies(id),
  ad_network_account_id       TEXT NOT NULL REFERENCES ad_network_accounts(id),
  network                     TEXT NOT NULL,
  external_campaign_id        TEXT NOT NULL,
  name                        TEXT,
  daily_budget_cents          BIGINT,
  total_budget_cents          BIGINT,
  status                      TEXT NOT NULL,                    -- active | paused | ended | banned
  created_by                  TEXT NOT NULL,                    -- agent | human
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (network, external_campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_camp_sub_co_status ON ad_campaigns (sub_company_id, status);

-- ─────────────────────────────────────────────────────────────────
-- Network API tokens (encrypted at rest; least-privilege)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_api_tokens (
  id                          TEXT PRIMARY KEY,                 -- nat_xxx
  network                     TEXT NOT NULL,                    -- meta | tiktok | google | x
  token_kind                  TEXT NOT NULL,                    -- system_user | oauth | dev_token | refresh
  token_encrypted             BYTEA NOT NULL,                   -- KMS-encrypted; never logged
  scope                       TEXT NOT NULL,                    -- comma-separated scopes
  rotated_at                  TIMESTAMPTZ,
  expires_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nat_network ON network_api_tokens (network);
CREATE INDEX IF NOT EXISTS idx_nat_expires ON network_api_tokens (expires_at);

-- ─────────────────────────────────────────────────────────────────
-- Agent action log (audit trail for every middleware action)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_action_log (
  id                          BIGSERIAL PRIMARY KEY,
  sub_company_id              TEXT REFERENCES sub_companies(id),
  actor                       TEXT NOT NULL,                    -- agent | human:user_xyz | system
  action                      TEXT NOT NULL,                    -- launchCampaign | pauseCampaign | rotateCreative | topUp | etc.
  target_kind                 TEXT,                             -- campaign | creative | balance
  target_id                   TEXT,
  payload                     JSONB,                            -- request data
  outcome                     TEXT NOT NULL,                    -- accepted | rejected
  rejection_reason            TEXT,                             -- balance_floor | rate_limit | cap_exceeded | invalid_input
  network                     TEXT,
  duration_ms                 INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aal_sub_co_created ON agent_action_log (sub_company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_aal_actor_action ON agent_action_log (actor, action);

-- ─────────────────────────────────────────────────────────────────
-- Webhook events (idempotency + audit)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id                          TEXT PRIMARY KEY,                 -- evt_xxx (provider's event id)
  source                      TEXT NOT NULL,                    -- stripe | meta | tiktok | etc.
  event_type                  TEXT NOT NULL,
  received_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at                TIMESTAMPTZ,
  status                      TEXT NOT NULL DEFAULT 'received', -- received | processed | failed
  error                       TEXT,
  payload                     JSONB
);
CREATE INDEX IF NOT EXISTS idx_we_source_received ON webhook_events (source, received_at);
CREATE INDEX IF NOT EXISTS idx_we_status ON webhook_events (status);

COMMIT;

-- ─────────────────────────────────────────────────────────────────
-- Optional: row-level security stubs (uncomment + customize before prod)
-- ─────────────────────────────────────────────────────────────────
-- ALTER TABLE sub_companies         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ad_network_accounts   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ad_credit_balances    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ad_credit_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE revenue_transactions  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ad_campaigns          ENABLE ROW LEVEL SECURITY;
-- (then create policies scoped to current_setting('app.current_sub_company_id'))
