# 01a — Meta Sub-Company Replication (Polsia Model)

The single source of truth for **how Zilla replicates Polsia's Meta architecture per sub-company** — what the engineer builds, what the operator experiences, and what gates the whole thing on Day-0.

This doc is the bridge between the high-level architecture (`ARCHITECTURE.md`, `01-ad-network-setup.md`) and the merchant-instance Meta runbook (root `META_ADS.md`).

---

## ✅ Status as of 2026-05-06: Day-0 COMPLETE

The Zilla parent Business Portfolio is provisioned end-to-end. Every Day-0 asset listed below is captured and live. The platform is now ready to mint per-sub-company assets via §5.

| Asset | Status | Value |
|---|---|---|
| Parent Business Portfolio | ✅ verified | `ZILLA_PARENT_BUSINESS_ID=1952475115474490` |
| Domain verification (`zilla.so`) | ✅ verified | DNS TXT in production |
| Business Verification | ⏳ submitted, awaiting Meta review | — |
| Corporate card on BP | ✅ on file | Brex / Amex (funding source for every child ad account) |
| Meta App | ✅ Live mode | `ZILLA_META_APP_ID=1281372737395331` |
| System User (`Platform`) | ✅ Admin + App role assigned | `ZILLA_SYSTEM_USER_ID=61589373840437` |
| System User token (Never expiring, 9 scopes) | ✅ rotated, in vault | `ZILLA_SYSTEM_USER_TOKEN` — Vercel env only, never committed |
| `.env.example` | ✅ updated | parent IDs populated as real values; token blank with `vercel env pull` instructions |
| Operator runbook | ✅ shipped | `ZILLA_HQ_SETUP_META.md` at repo root |

**Where the secret lives.** `ZILLA_SYSTEM_USER_TOKEN` is in the Zilla-HQ Vercel project env (Production + Preview + Development scopes) and the 1Password "Zilla Platform" vault. New engineers run `vercel link && vercel env pull .env.local` to populate it locally — never paste it into Slack, never commit it, never type it into a chat.

**What's still under construction (not blocking Day-0):**

- `lib/meta-platform.ts` — typed wrappers around the 7 Marketing-API calls in §5 (createOwnedPage, createOwnedAdAccount, createPixel, sharePixelWithAdAccount, assignSystemUser, setSpendCap, verifyDomain). Stubs land next.
- `inngest/functions/sub-company-onboard.ts` — the orchestrator that calls those wrappers in the §5 order with idempotency keys.
- Founder dashboard surface for the Pixel ID + ad account ID once a sub-co is provisioned.

---

## 1. Two audiences

This doc is read by two people.

**The Zilla engineer** building `inngest/functions/sub-company-onboard.ts` and the founder dashboard. Skim §2, then go to §4 (Day-0 IDs), §5 (the 14-step replication), §6 (the onboard function skeleton), §8 (gap analysis).

**The sub-company operator / founder** signing up to launch their AI-run merchant on Zilla. Skim §2, go to §7 (founder UX walkthrough). You don't need to know §4–6 — Zilla handles all of it for you.

---

## 2. The Polsia architecture (diagram)

```
                         ZILLA HQ (Day-0, one-time)
                         ─────────────────────────────────────────────
                         Zilla LLC — EIN, business address, business@zilla.so
                         │
                         ▼
            ┌─────────────────────────────────────────────────┐
            │ Zilla Business Portfolio (Meta)                │
            │  • Domain verified: zilla.so + sub-co .coms    │
            │  • Corporate card on file (Amex/Brex)          │
            │  • Business verified (when Meta prompts)        │
            │  • Tech Provider status (target: month 6)       │
            │  • System User: "Platform"               │
            │     └─ 60-day refresh token in `network_api_   │
            │        tokens` (encrypted)                       │
            │  • AEM allocations: per verified domain         │
            └──────────────────────────┬──────────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
       ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
       │ Sub-co A       │    │ Sub-co B       │    │ Sub-co N       │
       │ (e.g. SiteGrid)│    │ (e.g. Cabinet  │    │                │
       │                │    │  Co)           │    │                │
       │ • FB Page      │    │ • FB Page      │    │ ...            │
       │ • IG Business  │    │ • IG Business  │    │                │
       │ • Child Ad     │    │ • Child Ad     │    │                │
       │   Account      │    │   Account      │    │                │
       │   (inherits    │    │   (inherits    │    │                │
       │   parent card) │    │   parent card) │    │                │
       │ • Pixel        │    │ • Pixel        │    │                │
       │ • Daily spend  │    │ • Daily spend  │    │                │
       │   cap          │    │   cap          │    │                │
       │ • CAPI token   │    │ • CAPI token   │    │                │
       └────────────────┘    └────────────────┘    └────────────────┘
```

**Two non-obvious facts:**

- **The Page is brand-facing**, named for the sub-co (`SiteGrid`, not `Zilla — SiteGrid`). Users who click an ad land on a Page that looks like the brand, not Zilla. This matters for trust + ad QS.
- **The Pixel is per sub-co, not shared.** Pooling Pixels would break Aggregated Event Measurement (AEM is per-domain-and-Pixel) and contaminate optimization signal across brands.

**Money flow** (the part most people miss):

1. Founder signs up at zilla.so → pays Zilla $99/mo subscription via Stripe → tops up an ad-credit balance (e.g., $500) which lands in `ad_credit_balances.balance_cents` as `+50000`.
2. Zilla's corporate card on the parent BP pays Meta directly for any spend on the child ad account. Meta thinks Zilla is the customer.
3. Inngest cron `meta-spend-poll` (new — to be written) hits the Marketing API hourly, sees this child account spent $42 since last poll, debits `ad_credit_balances.balance_cents` by `-4200` and writes a settling row in `ad_credit_transactions`.
4. When the child's balance drops below the floor (`min_balance_cents`, default $5000 = $50), the AI agent stops launching new campaigns and notifies the founder to top up.

Founder never enters a card with Meta. Founder never sees a Meta invoice. Founder only sees the Zilla balance + the campaigns the agent launched on their behalf.

---

## 3. Day-0: Setting up the Zilla parent BP (one-time, ~2 hours)

> **This step is COMPLETE as of 2026-05-06.** The procedure below stays here as the canonical record of how it was done — and as the runbook anyone would follow to bring up a fresh Zilla parent BP from scratch (e.g. a clean second entity, an EU twin, or a disaster-recovery rebuild).

Done once by a Zilla HQ admin. Redoing it means migrating every existing sub-company, so do it carefully and with a backup admin.

> Prerequisite: a dedicated `business@zilla.so` Google Workspace account, a dedicated admin Facebook profile (NOT a personal one), Zilla's EIN + business address documents, and the Zilla corporate card.

**3.1 Create the BP** ✅ — `business.facebook.com/overview` → Create Business Portfolio → Name "Zilla", legal name "Zilla LLC" (or whatever the entity is), address, phone, website `zilla.so`. → Captured **`ZILLA_PARENT_BUSINESS_ID=1952475115474490`**.

**3.2 Add 2 admins with 2FA enforced.** A single-admin BP is a single point of failure. Use authenticator apps, not SMS.

**3.3 Verify `zilla.so`** ✅ — Brand Safety → Domains → Add `zilla.so` → DNS TXT method → paste `facebook-domain-verification=<value>` at root host. Verify. This covers all `*.zilla.so` subdomains.

**3.4 Add the Zilla corporate card** ✅ — Payment Methods → Add → enter Brex/Amex card. This becomes the funding source every child ad account inherits.

**3.4a Create the Meta App** ✅ — `developers.facebook.com/apps` → Create App → Business type → attach to the Zilla BP → set Live mode. The App is what System Users authenticate against. Captured **`ZILLA_META_APP_ID=1281372737395331`**. Add the App to the BP as a Business Asset (Business Settings → Apps → Add → existing App). The System User in 3.5 will need an explicit App role (3.5a) before it can mint a token.

**3.5 Create the System User** ✅ — Business Settings → System Users → Add → Admin role → name `Platform` (single word; Meta reserves multi-word names containing "Agent", "Bot", "Manager", etc., and rejected "Zilla Ads Agent" and "Zilla Platform"). Captured **`ZILLA_SYSTEM_USER_ID=61589373840437`**.

**3.5a Assign the System User an App role** ✅ — Business Settings → Users → System Users → `Platform` → Add Assets → Apps → select the Zilla App → toggle "Develop app" → Save. Without this step token generation hits `No permissions available — Assign an app role to the system user or select another app to continue.`

**3.6 Generate a never-expiring token** ✅ — Business Settings → Users → System Users → `Platform` → Generate New Token → select the Zilla App → expiration `Never` → tick the 9 scopes:

- `ads_management`
- `ads_read`
- `business_management`
- `pages_manage_posts`
- `pages_read_engagement`
- `pages_manage_metadata`
- `pages_show_list`
- `instagram_basic`
- `instagram_manage_insights`

Captured as **`ZILLA_SYSTEM_USER_TOKEN`** in Vercel (Production + Preview + Development) + 1Password "Zilla Platform" vault. **Never** committed to a repo, never pasted in Slack, never sent in chat. If it leaks, revoke and regenerate immediately at the same Generate New Token UI.

> **Why `Never` and not 60-day:** This is a backend production credential running on Vercel. There's no human to refresh it. A 60-day token means a hard outage every two months unless you build a refresh cron that the token's own expiration would kill anyway. Never-expiring is the correct production choice for a System User on a verified BP — Meta supports it specifically for this reason. Rotation is operational (do it on a schedule), not protocol (do not let Meta force it).

**3.7 Submit for Business Verification** ⏳ — submitted, awaiting Meta review. Expected to clear after the first non-trivial API spend or when Meta surfaces a "verify to keep advertising" prompt. Do not block onboarding on this — child ad accounts can run while review is pending.

**3.8 (Deferred) Apply for Tech Provider status** at month 6 of operation, before scaling past 25 sub-companies. Required to operate >25 ad accounts under one BP.

**Final Day-0 deliverable** — these env vars are now populated in Vercel + `.env.example`:

```bash
# Zilla HQ Meta platform (Day-0, one-time — committed to .env.example)
ZILLA_PARENT_BUSINESS_ID=1952475115474490   # from 3.1
ZILLA_META_APP_ID=1281372737395331          # from 3.4a
ZILLA_SYSTEM_USER_ID=61589373840437         # from 3.5
ZILLA_META_API_VERSION=v19.0                # already in .env.example as META_API_VERSION

# Secret — pulled from Vercel via `vercel env pull .env.local`, NEVER committed
ZILLA_SYSTEM_USER_TOKEN=                    # from 3.6
```

The existing `META_AD_ACCOUNT_ID` / `META_PAGE_ID` / etc. become **per-sub-company** values — stored in the database `sub_companies` row, not in `.env`.

---

## 4. Schema touchpoints

The parent vs child split changes how Meta IDs are stored. Today they're env vars (fine for one merchant). For Polsia they're database rows.

```sql
-- Parent-level: env vars only (or one zilla_platform table row)
ZILLA_PARENT_BUSINESS_ID
ZILLA_SYSTEM_USER_ID
ZILLA_SYSTEM_USER_TOKEN  -- via network_api_tokens table (encrypted)

-- Per sub-company: stored on sub_companies
sub_companies (
  id                            text primary key,
  brand_name                    text not null,
  domain                        text,                     -- e.g., 'sitegrid.com'
  domain_verified_at            timestamptz,
  fb_ad_account_id              text,                     -- 'act_<num>' from step 5.4
  fb_ad_account_status          text,                     -- 'pending' | 'active' | 'paused' | 'banned'
  fb_daily_spend_cap_cents      bigint default 5000,      -- $50/day default
  fb_page_id                    text,                     -- from step 5.2
  ig_account_id                 text,                     -- from step 5.3
  fb_pixel_id                   text,                     -- from step 5.7
  fb_capi_token_encrypted       text,                     -- from step 5.11, separate from System User token
  aem_events_configured_at      timestamptz,              -- step 5.10
  ...
)

-- Funding state per sub-co
ad_credit_balances (sub_company_id, balance_cents, min_balance_cents, ...)
ad_credit_transactions (sub_company_id, type, amount_cents, network='meta', ...)
```

Full schema in `architecture/schema/postgres-init.sql`.

---

## 5. The 14-step per-sub-company replication procedure

Each row is one logical step. For each: **mode** (`API` = automatable now, `UI` = manual click today, `VERIFY` = blocked on Meta human review), **API call** if applicable, **schema field** that gets written.

### 5.1 Domain verification — UI + DNS — `sub_companies.domain_verified_at`

If the sub-co uses a `.com` (independent domain model — preferred for serious GTM bets), verify it under the parent BP.

In Meta UI: Business Settings → Brand Safety → Domains → Add `sitegrid.com` → DNS TXT.

Then write the TXT record at the sub-co's domain DNS.

When verified, mark `sub_companies.domain_verified_at = now()`.

If the sub-co is a `*.zilla.so` subdomain, this step is **already done** — `zilla.so` root verification covers it. Skip and write the timestamp directly.

### 5.2 Create the Facebook Page — API — `sub_companies.fb_page_id`

```http
POST https://graph.facebook.com/v19.0/{ZILLA_PARENT_BUSINESS_ID}/owned_pages
Authorization: Bearer {ZILLA_SYSTEM_USER_TOKEN}
Content-Type: application/json

{
  "name": "{brand_name}",
  "category": "Business Service"
}
```

> The Page-creation endpoint on a BP is occasionally flaky — Meta sometimes requires owning_business explicit. If you hit `(#100) Page creation requires …`, fall back to creating via `/me/accounts` from an admin user, then immediately claiming via `POST /<bp_id>/pages` with `page_id`.

Save the returned `id` to `sub_companies.fb_page_id`.

### 5.3 Create + link the Instagram Business Account — UI today, API later — `sub_companies.ig_account_id`

There's no public API to create an IG Business Account from scratch. Workflow today:

1. Operator (Zilla, not founder) downloads IG mobile, signs up with sub-co handle.
2. IG → Settings → Switch to Business → Connect to the FB Page from §5.2.
3. In Meta UI: BP → Instagram Accounts → Add → import.

Then via API, get the IG account ID:

```http
GET https://graph.facebook.com/v19.0/{fb_page_id}?fields=instagram_business_account&access_token={ZILLA_SYSTEM_USER_TOKEN}
```

Save `instagram_business_account.id` to `sub_companies.ig_account_id`.

In v1, this step is part of the human ops checklist. In v2, automate via Meta's IG OAuth flow when it's available.

### 5.4 Create the child Ad Account inside the parent BP — API — `sub_companies.fb_ad_account_id`

```http
POST https://graph.facebook.com/v19.0/{ZILLA_PARENT_BUSINESS_ID}/owned_ad_accounts
Authorization: Bearer {ZILLA_SYSTEM_USER_TOKEN}
Content-Type: application/json

{
  "name": "Zilla — {brand_name} — US",
  "currency": "USD",
  "timezone_id": 1,
  "end_advertiser": "{ZILLA_PARENT_BUSINESS_ID}",
  "media_agency": "NONE",
  "partner": "NONE"
}
```

Returns `{ "id": "act_1234567890" }`. Save to `sub_companies.fb_ad_account_id`.

> `end_advertiser` set to Zilla's BP ID is what makes the ad account *owned* by Zilla. Don't pass the sub-co's BP — there isn't one.

> Currency + timezone are **locked at creation**. Mistakes cost a full account migration. Start every sub-co with `USD` + timezone `1` (Pacific) unless there's a hard reason not to.

### 5.5 Set the daily spend cap — API — `sub_companies.fb_daily_spend_cap_cents`

```http
POST https://graph.facebook.com/v19.0/{fb_ad_account_id}
Authorization: Bearer {ZILLA_SYSTEM_USER_TOKEN}
Content-Type: application/json

{
  "spend_cap": "5000"
}
```

`spend_cap` is in cents per the API but stored as a string. Default $50/day for new sub-cos to match Meta's low-trust ramp policy. Raise to $200 after day 7, $500 after day 14, etc.

### 5.6 Verify funding source inheritance — Manual check

Owned ad accounts inherit the parent BP's payment method automatically. Confirm in UI: BP → Payment Methods → click Zilla's Brex/Amex → see the new ad account listed.

If for any reason the child needs a different funding source (e.g., reconciliation isolation for a high-spend sub-co), assign explicitly via Business Settings → Payment Methods → Add Account.

No code action — but document confirmed in `sub_companies.notes`.

### 5.7 Create the Pixel / Events Dataset — API — `sub_companies.fb_pixel_id`

```http
POST https://graph.facebook.com/v19.0/{ZILLA_PARENT_BUSINESS_ID}/adspixels
Authorization: Bearer {ZILLA_SYSTEM_USER_TOKEN}
Content-Type: application/json

{
  "name": "{brand_name} Pixel"
}
```

Returns `{ "id": "1234567890123456" }`. Save to `sub_companies.fb_pixel_id`.

### 5.8 Connect the Pixel to the child Ad Account with **Manage** permission — API — n/a

```http
POST https://graph.facebook.com/v19.0/{fb_pixel_id}/shared_accounts
Authorization: Bearer {ZILLA_SYSTEM_USER_TOKEN}
Content-Type: application/json

{
  "business": "{ZILLA_PARENT_BUSINESS_ID}",
  "account_id": "{fb_ad_account_id}"
}
```

> **Gotcha:** This endpoint defaults to **Track-only** access. Track is not enough — ad creation will fail with `Account does not have access to pixel`. Upgrade to Manage in Meta UI: Events Manager → Pixel → Connected Assets → toggle "Manage Pixel" on the ad account. Or use the explicit task assignment endpoint:
> ```
> POST /{fb_pixel_id}/assigned_users
> { "user": "{ad_account_id}", "tasks": ["MANAGE"] }
> ```
> See META_ADS.md § 2.4 for the full backstory on this gotcha.

### 5.9 Connect the Pixel to the brand domain — UI — n/a

Events Manager → Pixel → Settings → Domains → Add `sitegrid.com`. Required for AEM and for the browser-side Pixel to send events from the brand's domain.

No public API for this as of Graph v19. v1 = manual; v2 = automate when available.

### 5.10 Configure AEM 8 events for the verified domain — UI — `sub_companies.aem_events_configured_at`

Events Manager → Aggregated Event Measurement → Web Events → click brand domain → Manage Events → allocate 8 in priority order. Default order:

1. Purchase
2. InitiateCheckout
3. Lead
4. AddToCart
5. ViewContent
6. CompleteRegistration
7. Custom_HotLead
8. Custom_HighIntent

Mark `sub_companies.aem_events_configured_at = now()` when done.

> No public API for AEM allocation. v1 = manual checklist step. Meta refreshes the allocation every 72 hours, so changes don't take effect immediately.

### 5.11 Generate the CAPI token — UI — `sub_companies.fb_capi_token_encrypted`

CAPI uses its own token, not the System User token.

Events Manager → Pixel → Settings → Conversions API → Generate access token → copy.

Encrypt with the platform-level KMS key, store as `sub_companies.fb_capi_token_encrypted`. The merchant template's `lib/meta-capi.ts` reads it from the env var `META_CONVERSIONS_API_TOKEN` today; the migrated code reads it from the sub-co row.

### 5.12 Assign the Platform System User to all 4 child assets — API — n/a

Four assignments per sub-co (one per asset type):

```http
# Ad Account
POST https://graph.facebook.com/v19.0/{fb_ad_account_id}/assigned_users
{ "user": "{ZILLA_SYSTEM_USER_ID}", "tasks": ["MANAGE", "ADVERTISE", "ANALYZE"] }

# Page
POST https://graph.facebook.com/v19.0/{fb_page_id}/assigned_users
{ "user": "{ZILLA_SYSTEM_USER_ID}", "tasks": ["MANAGE", "CREATE_CONTENT", "MODERATE", "ADVERTISE", "ANALYZE"] }

# IG Account
POST https://graph.facebook.com/v19.0/{ig_account_id}/assigned_users
{ "user": "{ZILLA_SYSTEM_USER_ID}", "tasks": ["MANAGE"] }

# Pixel
POST https://graph.facebook.com/v19.0/{fb_pixel_id}/assigned_users
{ "user": "{ZILLA_SYSTEM_USER_ID}", "tasks": ["MANAGE"] }
```

All 4 must succeed before the AI agent can launch a campaign.

### 5.13 Identity-thin merchant pre-check — VERIFY — gated

Meta is increasingly aggressive against new ad accounts where the underlying business has no real-world identity. Before the agent's first campaign, the sub-co must have:

- A live `.com` (or verified `*.zilla.so`) with About page, Privacy, Terms, Contact
- A populated FB Page with profile photo, About, posts (>3) before any ad runs against it
- Ideally a founder LinkedIn linked from the About page

This is checked at onboarding before flipping `sub_companies.fb_ad_account_status = 'active'`.

### 5.14 First campaign launch (low-trust ramp) — API — `ad_campaigns`

Same code path as merchant template's `scripts/meta-launch-campaign.ts`, but called with the sub-co's `fb_ad_account_id` and `fb_page_id` from `sub_companies`. **Gated by an ad-credit balance check** — if `ad_credit_balances.balance_cents < dailyBudget * 7`, refuse.

Start at $20/day for first 3 days, $40/day for next 4, $80/day after that. Auto-pause if Lead-CAC > `META_LEAD_CAC_CEILING_EARLY` for 24h on a base of `META_LEAD_MIN_SPEND` ad credit.

---

## 6. Engineer reference: `inngest/functions/sub-company-onboard.ts` skeleton

Roughly what the onboarding function looks like once Day-0 is done. Each step is its own Inngest `step.run` so failures are retried independently.

```ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { metaApi } from "@/lib/meta-platform";   // new: platform-level wrapper

export const subCompanyOnboard = inngest.createFunction(
  { id: "sub-company-onboard", name: "Onboard Sub-Company to Zilla" },
  { event: "subco/onboard.requested" },
  async ({ event, step }) => {
    const { subCompanyId } = event.data;
    const subCo = await step.run("load-subco", () =>
      db.subCompanies.findUniqueOrThrow({ where: { id: subCompanyId } })
    );

    // Steps 5.1–5.14 — each in its own step.run
    await step.run("verify-domain", async () => {
      if (subCo.domainVerifiedAt) return;
      // For *.zilla.so, mark verified directly. For independent .com,
      // poll DNS TXT presence + call BP verify endpoint.
      const verified = await metaApi.verifyDomain(subCo.domain);
      if (!verified) throw new RetryAfter("DNS TXT not propagated yet", "30m");
      await db.subCompanies.update({
        where: { id: subCo.id },
        data: { domainVerifiedAt: new Date() },
      });
    });

    const fbPageId = await step.run("create-page", async () => {
      const { id } = await metaApi.createOwnedPage({
        bpId: process.env.ZILLA_PARENT_BUSINESS_ID!,
        name: subCo.brandName,
        category: "Business Service",
      });
      await db.subCompanies.update({ where: { id: subCo.id }, data: { fbPageId: id } });
      return id;
    });

    // Step 5.3 IG: route through ops checklist for v1, return existing ID
    const igAccountId = await step.run("link-ig", async () => {
      if (subCo.igAccountId) return subCo.igAccountId;
      throw new BlockedOnHumanOps(
        "IG Business Account creation requires mobile UI. " +
        "Ops, please create + link, then PATCH sub_companies.ig_account_id."
      );
    });

    const fbAdAccountId = await step.run("create-ad-account", async () => {
      const { id } = await metaApi.createOwnedAdAccount({
        bpId: process.env.ZILLA_PARENT_BUSINESS_ID!,
        name: `Zilla — ${subCo.brandName} — US`,
        currency: "USD",
        timezoneId: 1,
        endAdvertiser: process.env.ZILLA_PARENT_BUSINESS_ID!,
      });
      await db.subCompanies.update({ where: { id: subCo.id }, data: { fbAdAccountId: id } });
      return id;
    });

    await step.run("set-spend-cap", () =>
      metaApi.setSpendCap({ adAccountId: fbAdAccountId, capCents: 5000 })
    );

    const fbPixelId = await step.run("create-pixel", async () => {
      const { id } = await metaApi.createPixel({
        bpId: process.env.ZILLA_PARENT_BUSINESS_ID!,
        name: `${subCo.brandName} Pixel`,
      });
      await db.subCompanies.update({ where: { id: subCo.id }, data: { fbPixelId: id } });
      return id;
    });

    await step.run("share-pixel-with-ad-account", () =>
      metaApi.sharePixelWithAdAccount({
        pixelId: fbPixelId,
        bpId: process.env.ZILLA_PARENT_BUSINESS_ID!,
        adAccountId: fbAdAccountId,
        task: "MANAGE",
      })
    );

    // Step 5.9 + 5.10: AEM is UI-only. Block on ops.
    await step.run("aem-config-check", async () => {
      const fresh = await db.subCompanies.findUniqueOrThrow({ where: { id: subCo.id } });
      if (!fresh.aemEventsConfiguredAt) {
        throw new BlockedOnHumanOps("Configure AEM 8 events for verified domain.");
      }
    });

    await step.run("capi-token-check", async () => {
      const fresh = await db.subCompanies.findUniqueOrThrow({ where: { id: subCo.id } });
      if (!fresh.fbCapiTokenEncrypted) {
        throw new BlockedOnHumanOps("Generate CAPI token in Events Manager and store.");
      }
    });

    await step.run("assign-system-user", async () => {
      // 4 parallel assignments
      await Promise.all([
        metaApi.assignSystemUser({ assetId: fbAdAccountId, tasks: ["MANAGE", "ADVERTISE", "ANALYZE"] }),
        metaApi.assignSystemUser({ assetId: fbPageId, tasks: ["MANAGE", "CREATE_CONTENT", "MODERATE", "ADVERTISE", "ANALYZE"] }),
        metaApi.assignSystemUser({ assetId: igAccountId, tasks: ["MANAGE"] }),
        metaApi.assignSystemUser({ assetId: fbPixelId, tasks: ["MANAGE"] }),
      ]);
    });

    await step.run("identity-thin-precheck", async () => {
      const fresh = await db.subCompanies.findUniqueOrThrow({ where: { id: subCo.id } });
      const checks = await runIdentityChecks(fresh);
      if (!checks.passes) throw new BlockedOnHumanOps(`Identity-thin: ${checks.failedReasons.join(", ")}`);
    });

    // Mark active. The first campaign launch is event-driven (subco/campaign.requested).
    await step.run("activate", () =>
      db.subCompanies.update({
        where: { id: subCo.id },
        data: { fbAdAccountStatus: "active", fbActivatedAt: new Date() },
      })
    );

    await inngest.send({ name: "subco/activated", data: { subCompanyId } });
  }
);
```

**Rollback** when an early step succeeds and a later one fails: don't auto-delete child resources (Meta resists deletion + you'd lose audit trail). Mark `fbAdAccountStatus = 'failed_onboarding'` and route to ops queue. Resume idempotently — every API call should be safe to retry without creating duplicate child resources (use the DB row's existing ID if present, otherwise create).

**Idempotency keys:** every Inngest event includes `subCompanyId`; Meta API calls aren't natively idempotent, so the per-step DB write happens *before* the next step starts. If a retry runs `create-ad-account` and the row already has `fbAdAccountId`, the step short-circuits.

---

## 7. Operator reference: what the founder experiences

The founder of a sub-Zilla company never touches Meta. Here's what they see:

**Day 0 (sign-up, ~5 min):**
1. Land at `zilla.so/start` → pick vertical (e.g., "AI agency for cabinet shops").
2. Pay $99/mo subscription via Stripe Checkout.
3. Pick a brand name — Zilla offers 3 AI-generated suggestions, founder picks or types one.
4. Pick a domain — either `[brand].zilla.so` (free, instant) or attach an independent `.com` (founder owns or buys via Zilla's reseller flow).
5. Top up an ad-credit balance: $250 / $500 / $1,000 / custom. Goes via Stripe Payment Intent, lands in `ad_credit_balances`.

**Day 0 (background, founder doesn't see):**
- The `subco/onboard.requested` event fires.
- §5.1–5.14 runs. Most steps complete in <2 min. The IG and AEM steps block on Zilla ops (see §8 — until automated).
- Founder sees a "We're getting your business ready — usually done in ~30 min" status screen.

**Day 1 (founder logs in to dashboard):**
- Sees three modules:
  - **Revenue** — Stripe Connect powered. $0 today, projected based on early signal.
  - **Ad Credits** — current balance, top-up button, projected runway based on current daily spend.
  - **Performance** — last 7 days of impressions, clicks, leads, sales. Sourced from `meta-spend-poll` cron.
- Sees an **Agent feed** — chronological list of what the AI agent did:
  - "Launched Lead campaign at $20/day"
  - "Generated 3 video creatives, A/B testing"
  - "Paused Ad Set 'Cabinet B' — CAC $87 exceeds target $75"
  - "Topped up — $500 credit added by founder"

**The founder never sees:**
- Their Meta Business Portfolio (it's Zilla's, not theirs)
- A Meta invoice (Meta bills Zilla)
- A System User token, ad account ID, Pixel ID
- An AEM allocation screen, Events Manager, CAPI token

**The founder DOES see:**
- The brand-facing FB Page (read-only Zilla view + a "Open in Meta" link they can use to log in with a guest account if they want — read-only)
- Their Pixel events flowing in (graphs, no IDs)
- Their Stripe payouts (their own Stripe Connect Express account)
- Their balance, their credits, their performance

**What if the founder wants to bring their own Meta account?** v1 default = no, single-tenant Polsia model, no escape valve. v2 may add a "BYOM" option — see ARCHITECTURE.md § Open Questions.

---

## 8. What's already built vs what needs building

A clean inventory as of 2026-05-06.

### Already built (works today, single-merchant model)
- `lib/meta-ads.ts` — Marketing API client wrapper (campaign create, ad create, insights)
- `lib/meta-capi.ts` — Conversions API client
- `scripts/meta-launch-campaign.ts` — single-merchant campaign launcher
- `inngest/functions/meta-ads-sync.ts` — hourly insights snapshot
- `inngest/functions/meta-ads-autonomy.ts` — daily Purchase-CAC pause/resume
- `inngest/functions/meta-ads-lead-scaler.ts` — daily budget +20% / 3 days
- `inngest/functions/meta-ads-fatigue-check.ts` — frequency > 2.5 alerts
- Pixel code in `components/marketing/ad-pixels.tsx`
- Server-side CAPI in `app/api/...` routes

### Built but needs migration to per-sub-co
- All of the above currently read `META_*` env vars. Migration: read from `sub_companies` row (looked up by host or by Clerk session), fall back to env vars only for a "demo" / single-merchant deployment. New helper: `getMetaContext(subCompanyId): { adAccountId, pageId, pixelId, ... }`.

### Not yet built — needed for Polsia model
- **Day-0 work** — see §3. Actual humans creating the Zilla parent BP at Meta.
- **`lib/meta-platform.ts`** — new wrapper around all parent-BP-level operations (`createOwnedPage`, `createOwnedAdAccount`, `createPixel`, `sharePixelWithAdAccount`, `assignSystemUser`, `setSpendCap`, `verifyDomain`).
- **`inngest/functions/sub-company-onboard.ts`** — orchestrator from §6.
- **`inngest/functions/meta-spend-poll.ts`** — hourly cron, hits Insights API for every active sub-co's `fb_ad_account_id`, debits `ad_credit_balances`, writes `ad_credit_transactions`.
- **`inngest/functions/meta-spend-cap-enforcer.ts`** — when `ad_credit_balances.balance_cents < min_balance_cents`, pause all active campaigns for that sub-co.
- **`db/schema.ts` changes** — add the columns enumerated in §4 to `sub_companies`. Add `ad_credit_balances` and `ad_credit_transactions` tables. SQL is in `architecture/schema/postgres-init.sql` — translate to Drizzle.
- **Stripe Connect Express flow** — `app/api/stripe/connect/onboarding/route.ts`, replacement of the existing flat Stripe Checkout with destination charges + `application_fee_amount`. Spec in `02-payments-and-ledger.md`.
- **Founder dashboard module: Ad Credits** — `app/(dashboard)/credits/page.tsx`. Reads `ad_credit_balances`, top-up via Stripe PI, polls `ad_credit_transactions` for history.
- **Agent feed UI** — chronological view of `agent_action_log` filtered by sub-co.
- **Identity-thin precheck** — function that pulls FB Page age, post count, About completeness, founder LinkedIn from sub-co data; threshold-based pass/fail.
- **AEM allocation human-ops queue** — admin page at `/admin/ops/aem-queue` listing sub-cos awaiting AEM config. Phase 2: automate via undocumented internal Meta endpoint or partner with a Meta Solutions Provider that has access.

### Out of scope for v1
- Bring-your-own-Meta-account ("BYOM")
- Real-time CAPI verification on agent actions
- Per-sub-co AEM allocation via API (Meta hasn't shipped this)
- Multi-region (every sub-co is US-only at v1)

---

## 9. How this connects to META_ADS.md (the merchant-instance runbook)

`META_ADS.md` at the repo root remains valid for the **single-merchant deployment** of the template (i.e., when someone forks the repo for a non-Zilla project). It's also valid for SiteGrid as it currently exists — SiteGrid runs on its own Meta BP under the standalone model.

For Zilla-platform-managed sub-companies, the relationship inverts:
- Steps 2.1 (BP creation), 2.2 (App Live mode), 2.3 (System User token), 2.4 (Pixel ↔ Ad Account link), 2.5 (CAPI token) — **all done by Zilla, once, at Day-0**. Founder skips entirely.
- Steps 2.6 (Test Events), §3 (Pixel + CAPI implementation), §4 (campaign launch) — **automated by sub-company-onboard.ts** + the existing Inngest crons. Founder skips.
- The "When NOT to use this" warning at the top of META_ADS.md still applies — paid social is not an immediate-revenue lever, and the agent should not over-spend in week 1.

---

## 10. Open questions

- **BYOM escape valve.** Some founders may want to bring their own Meta account (e.g., they have $100k of historical spend signal they don't want to lose). v2 design TBD. For v1, hard "no."
- **Refund flow at the ad-credit layer.** If a founder requests a refund of unspent credit, what happens to the Meta side? Pause everything, then issue Stripe refund? Spec in `02-payments-and-ledger.md` § Refund handling — confirm.
- **AEM API.** Meta has hinted at a public AEM allocation API in roadmap. Track and remove the human-ops bottleneck once it ships.
- **Tech Provider scaling.** When does the 25-account limit force the application? Budget for early month-6 application, but if a single sub-co hits high spend faster, it might trigger sooner. Monitor.
- **Cross-account bans.** If one sub-co violates Meta policy and gets the parent BP restricted, every other sub-co goes dark. Mitigations: identity-thin precheck (§5.13), spread sub-cos across verticals, never let an agent approach a known-banned ad copy. v2: Tech Provider status reduces blast radius.