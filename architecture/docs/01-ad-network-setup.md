# 01 — Ad Network Setup

How Zilla provisions and operates parent/child ad infrastructure across Meta (Facebook + Instagram), TikTok, Google Ads, and X.

**Audience:** operations, GTM, anyone bootstrapping the parent accounts or onboarding a new sub-company. Engineers building automated provisioning should read this alongside `docs/03-engineering-spec.md`.

**Companion checklist:** `checklists/parent-bootstrap.md` (Day-0) and `checklists/new-sub-company.md` (per sub-company).

---

## 1. Terminology

The four networks use different names for the same parent-container concept:

| Network | Parent Container | Child / Asset |
|---------|------------------|---------------|
| Meta (Facebook + Instagram) | **Business Portfolio** (formerly "Business Manager") | Ad Account, Page, Instagram Business Account, Pixel / Events Dataset |
| TikTok | **Business Center** (BC) | Advertiser Account, TikTok Pixel, Spark Ads connection |
| Google Ads | **Manager Account** (a.k.a. **MCC** — My Client Center, the legacy term) | Child Google Ads account, GA4 property, Google Tag |
| X (Twitter) | X Ads (no formal parent — operates per-account) | Ads account, X Pixel |

When this doc says "the parent" it means whichever of these applies to the network.

---

## 2. Pre-Flight Decisions

These four decisions cascade through every platform. Get them wrong and you redo work.

**2.1 Legal entity and naming.** Every parent must be tied to "Zilla" the legal entity. Have the EIN, business address, and a `business@zilla.so` email ready. Verification on Meta and TikTok requires utility bills or articles of incorporation matching the name.

**2.2 Domain strategy for sub-companies.**

- **Subdomain model (Polsia approach):** Each sub-company lives at `[brand].zilla.so`. Pros: faster, no domain purchases, root-domain verification on Meta covers all subdomains. Cons: brand confusion, lower conversion rates.
- **Independent domain model:** Each sub-company gets its own `.com`. Pros: clean brand, higher trust. Cons: domain verification + identity setup must be redone per brand.

**Default policy:** independent domains for any sub-company that's a real GTM bet (e.g., SiteGrid). Subdomains only for experiments under $1k/mo ad spend.

**2.3 Centralized payment method.** A single Zilla corporate card funds every child ad account on every platform. Do not let individual sub-companies enter their own cards. Centralization is what enables (a) eventual margin opportunities, (b) instant shutoff of a brand, (c) clean accounting.

**2.4 Naming convention** (apply across all platforms, lock now):

- Ad accounts: `Zilla — [BrandName] — [Region]` (e.g., `Zilla — SiteGrid — US`)
- Pages: `[BrandName]` only (no Zilla prefix — users see this)
- Pixels / Events Datasets: `[BrandName] Pixel`
- Campaigns: `[Brand] | [Funnel Stage] | [Geo] | [Date]`
- Ad sets: `[Audience] | [Placement]`

---

## 3. Meta (Facebook + Instagram)

The most important and most fragile of the four. Set up Meta first.

### 3.1 Create Zilla's Meta Business Portfolio (one-time)

1. Go to `business.facebook.com/overview` and create a new **Business Portfolio**. Name it "Zilla."
2. Use a `business@zilla.so` email tied to a dedicated admin Facebook profile. Do NOT use a personal profile.
3. Add the company legal name, address, phone, and website (`zilla.so`).
4. Add at least 2 admins with 2FA enforced. Single-admin Portfolios are a single point of failure.

### 3.2 Business Verification

Inside Business Portfolio → Security Center → **Business Verification**.

**Modern note:** Meta has split the old monolithic Business Verification into smaller, use-case-specific checks. As of 2026, basic ad-account creation no longer requires it. You'll be prompted later when crossing spend thresholds, requesting elevated API access, or applying for Tech Provider. Submit it when prompted; don't fight to do it preemptively.

### 3.3 Domain verification

In Business Portfolio → Brand Safety → **Domains**. Add and verify:

- `zilla.so` (DNS TXT record — preferred over meta-tag and HTML upload)
- Each independent sub-company domain (`sitegrid.com`, etc.)

Verification of the root `zilla.so` automatically covers every `*.zilla.so` subdomain. Independent domains must be verified separately.

**TXT record format** (paste at root host `@`):
```
facebook-domain-verification=<value Meta provides>
```

Verification typically completes in 5–60 minutes after DNS propagation. Use `dig TXT zilla.so +short` to confirm before clicking Verify in Meta.

### 3.4 Per-sub-company asset creation

For each sub-company:

1. **Facebook Page.** Business Portfolio → Pages → Add → Create new. Name = brand only.
2. **Instagram Business Account.** IG → Settings → Switch to Business → Connect to the new FB Page. Then Business Portfolio → Instagram Accounts → Add.
3. **Ad account.** Business Portfolio → Ad Accounts → Add → Create new. Naming: `Zilla — SiteGrid — US`. Currency and time zone are locked at creation.
4. **Payment method.** Business Portfolio → Payment Methods → assign Zilla's corporate card to this ad account.
5. **Pixel / Events Dataset.** Business Portfolio → Events Manager → Create dataset → name `SiteGrid Pixel`. Connect to ad account and brand site.
6. **Conversions API (CAPI).** Non-negotiable post iOS 14.5. Use CAPIG (Conversions API Gateway, easiest), Stape (server-side GTM), or direct CAPI.
7. **Aggregated Event Measurement.** Configure 8 conversion events for the verified domain, ordered by priority. Typical order: `Purchase > InitiateCheckout > AddToCart > Lead > ViewContent > [3 custom]`.
8. **Access.** Assign the `Platform` System User (see 3.5) to the ad account, Page, IG, and Pixel — Business Settings → System Users → `Platform` → Add Assets → tasks: `MANAGE`, `ADVERTISE`, `ANALYZE`.

Time per sub-company once you've done two: ~25 minutes.

### 3.5 Programmatic access (for the AI agent)

Business Portfolio → Business Settings → **System Users**. Create a system user named `Platform` (single word — Meta reserves multi-word names containing "Agent", "Bot", "Manager", etc.). Assign admin access on each child ad account, page, and pixel. Generate a **never-expiring** access token (Meta supports this for System Users on a verified BP — correct choice for an unattended backend).

This token is what zilla-v2's backend uses to call the Meta Marketing API. It's the same pattern Polsia uses — a single backend identity holding access to many child resources. The full Day-0 procedure (App creation, App-role assignment, scope list, recovery from leaks) lives in [`01a-meta-sub-company-replication.md` § 3](./01a-meta-sub-company-replication.md#3-day-0-setting-up-the-zilla-parent-bp-one-time-2-hours).

### 3.6 Spend ramp policy

Meta puts new ad accounts on a low daily-spend cap (~$50/day) until trust builds. Don't start a new account at $500/day — it gets flagged. Start at $20–50/day for the first 3–7 days, scale 20% every 2–3 days.

---

## 4. TikTok Ads

TikTok's structure mirrors Meta's almost exactly. Cleaner because TikTok built BC after watching Meta's mistakes.

### 4.1 Create Zilla's Business Center

1. Go to `business.tiktok.com/manager` and create a new Business Center named "Zilla."
2. Add legal entity details. TikTok requires business verification — same documents as Meta.
3. Enforce 2FA for all admins.

### 4.2 Per-sub-company assets

For each sub-company:

1. **TikTok Business account** (the organic side). Username = brand handle.
2. **Advertiser account** in BC → Advertiser Accounts → Create. Naming: `Zilla — SiteGrid — US`.
3. **Payment method.** Assign Zilla's corporate card.
4. **Spark Ads connection.** Connect TikTok organic account to advertiser account so you can boost organic creator content. Highest-ROI placement; mandatory for any UGC strategy.
5. **TikTok Pixel + Events API.** Server-side is the only thing that survives ad blockers and iOS.
6. **TikTok Shop application** (if sub-company sells physical products; skip for SaaS).

### 4.3 Programmatic access

BC → Members → Add. Create a developer/agent user. Generate a Marketing API token. TikTok's API supports campaign create, audience sync, conversion reporting.

---

## 5. Google Ads

Google's MCC is purpose-built for this exact pattern. Easiest of the four.

### 5.1 Create the Zilla Manager Account

Go to `ads.google.com/home/tools/manager-accounts/` and create a Manager Account named "Zilla." Use a Google Workspace email at `@zilla.so`. The MCC itself doesn't run ads — purely management.

### 5.2 Per-sub-company

For each sub-company:

1. MCC → "+ button" → Create new account. Naming: `Zilla — SiteGrid — US`.
2. Time zone and currency: locked at creation.
3. Link to a fresh GA4 property (do not pool sub-companies into one GA4).
4. Install Google Tag (server-side via GTM Server Container preferred).
5. Apply Zilla's Google Ads payment profile. MCC supports cross-account billing — parent profile pays for all children.
6. Configure conversions before any traffic. Smart Bidding can't optimize without them.

### 5.3 Verification

Google has a separate "Advertiser Verification" flow you'll be prompted to complete **per child account**. ~30 minutes of identity + business doc upload per sub-company. Some verticals (financial services, healthcare, gambling) require additional certification — check policy before creating the account.

### 5.4 Programmatic access

Google Ads API uses OAuth + a developer token. The MCC's developer token, once approved (apply via API Center), works across all child accounts. **Apply for it now even if not building yet** — approval takes 1–7 days.

---

## 6. X (Twitter) Ads

The wonkiest of the four. Treat as low priority.

### 6.1 Parent account

Go to `ads.x.com` and create an ads account using a `business@zilla.so` X handle. There's no true Business Manager equivalent. The closest is the X Business profile — supports multiple ad accounts under one login but the management UX is poor.

### 6.2 Per-sub-company

1. Create an X handle for the brand (e.g., `@SiteGrid`) and verify as Business profile.
2. Create new ad account under the Zilla login. Naming: `Zilla — SiteGrid`.
3. Configure billing. Polsia-style central card pattern doesn't work as cleanly here; you may need the same card on multiple accounts.
4. Install X Pixel / Conversion API. Less critical than Meta/TikTok because X conversion volume is low.

### 6.3 Programmatic access

X Ads API requires a paid Ads API tier. Was free pre-2023. Likely not worth it for v1 — treat X as organic-only for now.

---

## 7. Operational Hygiene

**One Zilla Sub-Company Master Sheet.** A single Google Sheet listing every sub-company and the IDs/URLs of every asset on every platform. Without it, you'll spend an hour every time you need to find anything.

**Don't run ads from a personal profile, ever.** Every platform has a separate "personal" identity layer. If the personal admin profile gets banned, everything they touch goes with it. Use a dedicated `admin@zilla.so` Google Workspace identity.

**2FA on every account, no exceptions.** A single SIM-swap takes down the entire BP. Use authenticator apps, not SMS.

**Stagger account creation.** Don't create 8 ad accounts in one day from one IP — looks like fraud to Meta. Spread across a week.

**Least-privilege agent tokens.** Don't give the agent the master admin token. Per-platform System User with only required permissions. If the agent goes rogue, revoke just that token.

**Hard spend caps at the account level, always.** Set a daily cap on every child ad account before any campaign launches. Recovery from an agent-driven runaway campaign is much costlier than the friction of manually raising caps.

**Document every policy violation.** When (not if) an ad gets disapproved, log: which sub-company, which creative, which policy, appeal outcome. This becomes training data and a defense file.

---

## 8. Scaling Risks

**Meta Business Partner threshold.** A normal Business Portfolio holds up to 25 ad accounts before requiring Tech Provider status. At 4–10 sub-companies we're well under. Apply for Tech Provider by month 6 of operation, before scaling past 50.

**Identity-thin merchant problem.** Meta has been increasingly aggressive against ad accounts where the underlying business has no real-world identity (no LinkedIn, no Google business profile, no press). Mitigation: each sub-company should have a real LinkedIn, real founder profile, ideally one human's identity verified on the ad account.

**TikTok cross-account ban contagion.** TikTok will sometimes ban every advertiser account under a Business Center if 2+ children get policy-banned in close succession. Spread risk by NOT clustering all sub-companies in one vertical.

**Google's per-vertical certifications.** Some verticals (financial services, gambling, alcohol, healthcare, political) require per-vertical advertiser certification on top of standard Verification. Do the certification BEFORE creating the account.

**X is unpredictable.** X has been rate-limiting and de-prioritizing brand-new advertiser accounts. Don't plan X as a primary channel.

**Single point of failure: the corporate card.** If Zilla's master payment method gets declined, every child account on every platform goes dark simultaneously. Have a backup card on file before you need one (Apple Card, Brex backup, second corporate card on a different network).

---

## 9. Estimated Timeline

- **Day 0:** Create all four parent accounts. Submit verifications.
- **Day 1–3:** Verifications return (Meta and TikTok 1–3 days; Google instant; X instant).
- **Day 3:** Domain verifications + payment methods configured on each parent.
- **Day 4–10:** First two sub-companies fully provisioned, launching test campaigns at low spend.
- **Day 10–25:** Remaining sub-companies onboarded, one every 1–2 days.
- **Day 25–30:** Spend ramp on proven sub-companies; agent API tokens generated.

Total to "first sub-company live on all four channels": ~7–10 days. Total to "4–10 sub-companies running": ~25–30 days.
