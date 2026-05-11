# Google Ads — engineer runbook

> Distilled from setting up Restay's Google Ads infrastructure end-to-end. Every gotcha here cost real time to discover; following this top-to-bottom should let you launch a branded-defense campaign for any new portfolio merchant in **~10 minutes** (programmatic, once Basic Access is granted) or **~30 minutes** (manual UI, no API needed).

This is the engineer's manual for Google Ads paid acquisition. Companion docs:
- **[GOOGLE_ADS_OPERATOR.md](./GOOGLE_ADS_OPERATOR.md)** — for the sub-company operator running their merchant's Google Ads day-to-day (less technical)
- **[META_ADS.md](./META_ADS.md)** — Meta paid acquisition (Reels-led, OUTCOME_LEADS optimization)

---

## ⚠️ Current status: Basic Access pending

> **Last updated 2026-05-06**. Restay (the first portfolio merchant to set this up) submitted the **Google Ads API Token Application** with Test → Basic upgrade request on 2026-05-06. **Basic Access approval is typically 1 business day**; until it lands, the API scripts in this doc cannot run against real ad accounts. The manual UI flow works fine; the programmatic launch + Inngest auto-scaler activate the moment Basic is approved.
>
> **Next milestone: hear back from Google on the Basic Access application** (check `jack@seifdn.org` inbox). When approved, re-run `scripts/google-ads-smoke-test.ts` on the new merchant — should succeed instead of returning `DEVELOPER_TOKEN_NOT_APPROVED`.
>
> Future merchants reuse the **same Manager Account, same developer token, same OAuth client, same refresh token** — no new Google approval is needed per merchant once Basic is granted. You only need to (a) create a new ad account, (b) link it to the Zilla HQ MCC, (c) set the merchant-specific env vars. See §3.

---

## 0. When NOT to use this

Google Search Ads is not a replacement for Meta. The two channels target different intent:

- **Meta** = interrupting passive scrolling with a hook → highest volume, lower intent, needs creative + audience optimization
- **Google Search** = capturing existing search intent → lower volume, higher intent, keyword + landing page optimization

For a new merchant, the **branded-defense campaign** described in this doc is essentially mandatory ($50–60/mo, set-and-forget) — it costs almost nothing and prevents competitors from bidding on your brand name.

Beyond branded defense, Google Search makes sense only when the merchant has a $500+/mo paid budget AND has validated that someone is actually searching for the category (not just the brand). Until then, Meta is the lead-acquisition channel; Google is the brand-defense moat.

---

## 1. Architecture overview

```
┌────────────────┐    gtag("config", "AW-...")        ┌────────────────┐
│  Browser       │ ─────────────────────────────────▶│  Google Ads    │
│  (Next.js page)│    gtag("event", "conversion",    │  Conversion    │
│                │      {send_to, value, currency})  │  Tracking      │
└──────┬─────────┘                                   └────────────────┘
       │
       │  POST /api/checkout, /api/stripe/webhook              ▲
       ▼                                                       │ matches by gclid
┌────────────────┐    Marketing API mutate            ┌────────────────┐
│  Server route  │ ─────────────────────────────────▶│  Marketing API │
│  (lib/google-  │  (programmatic campaign creation,  │  googleads.    │
│   ads.ts)      │   keyword updates, budget shifts)  │  googleapis    │
└────────────────┘                                   └────────────────┘
                                                              │
                       ┌──────────────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────────────┐
       │  Google Ads optimization — surfaces│
       │  your ad to people searching your  │
       │  keywords or related intent        │
       └─────────────┬──────────────────────┘
                     │
                     ▼
       ┌────────────────────────────────────┐
       │  Inngest crons (this template):    │
       │  • google-ads-sync     hourly      │
       │  • google-ads-scaler   1:30am UTC  │
       └────────────────────────────────────┘
```

The template gives you the **plumbing** (gtag, Marketing API client, autonomy crons). This doc tells you how to **wire it to your specific Google Ads Manager Account + ad account** so it actually works.

---

## 2. One-time Zilla HQ setup (do this ONCE, all merchants reuse)

These steps are done once at the Zilla HQ org level. **Future merchants do NOT redo any of this.** They only do §3 (the per-merchant steps).

> If Zilla HQ has already done this, skip to §3 directly. Current state of completion is in the **Status snapshot** at the top of this doc.

### 2.1 Create the Manager Account (MCC)

A Manager Account (also "MCC" — My Client Center) sits *above* individual ad accounts. It lets one set of API credentials manage many ad accounts under one roof.

For Zilla HQ, this is mandatory because:
- The **Developer Token is gated behind a Manager Account** (the API Center page on a regular ad account shows "API Centre is only available to manager accounts")
- Each portfolio brand gets its own ad account, all managed under one MCC for centralized credentials

Steps:
1. Go to **https://ads.google.com/home/tools/manager-accounts/**
2. Click **"Create a Manager account"** → sign in with the Zilla HQ Google account (e.g., `jack@seifdn.org`)
3. Fill in:
   - Manager account name: `Zilla HQ`
   - Use: "Manage other people's accounts"
   - Country: United States
   - Currency: USD
4. Note the **MCC Customer ID** (10 digits, top-right of MCC dashboard) — this is `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for every merchant.

### 2.2 Apply for the Developer Token

The Developer Token is a per-MCC credential that authorizes API access. There are three tiers:

| Tier | Daily ops quota | Works on real accounts? | Approval |
|---|---|---|---|
| **Test** | 15,000 ops | ❌ Only on Google's special "test accounts" (sandbox) | Auto-granted instantly |
| **Basic** | 15,000 ops | ✅ Yes, on accounts under your MCC | Application required, ~1 business day |
| **Standard** | Unlimited | ✅ Yes, on any account | Application required, 3+ business days, requires more rigorous review |

**Zilla HQ needs Basic.** Test access is useless for real campaign management. Standard is overkill (only needed if Zilla HQ ever wants to operate on accounts NOT under its MCC, which is not the plan).

Steps:
1. From the MCC, go to **https://ads.google.com/aw/apicenter**
2. The first time you visit, you'll see "Apply for token." Click it. **Test access is granted instantly** — this gives you a token but it only works on test accounts.
3. Then click **"Apply for Basic Access"** → fills the **Google Ads API Token Application** form.
4. The form asks for:
   - Company info (Zilla HQ, jack@seifdn.org)
   - MCC ID (the one created in §2.1)
   - Business model description (paste from `docs/GOOGLE_ADS_DESIGN_DOC_TEMPLATE.md`)
   - **Design documentation (PDF)** — required for Basic. The template provides one at `docs/google-ads-design-doc-template.md` — convert to PDF and upload.
   - Capability checkboxes — `Campaign Creation`, `Campaign Management`, `Reporting` (skip the others)
   - Campaign types — `Search, Video`
5. Submit. **Approval typically 1 business day.** Email goes to the MCC contact email (`jack@seifdn.org`).
6. Once approved, the same Developer Token now works on Basic-tier — no new token, no rotation.

> ⚠️ **Pre-Basic:** the template's launch scripts will fail with `DEVELOPER_TOKEN_NOT_APPROVED`. You can still launch campaigns manually via the Ads UI (see GOOGLE_ADS_OPERATOR.md). API automation activates the moment Basic is granted.

### 2.3 Google Cloud Project + OAuth Client

The OAuth flow proves the API caller is authorized to act as the MCC owner.

1. Go to **https://console.cloud.google.com/**
2. Create a new project named `zilla-hq` (or reuse an existing one).
3. **Enable the Google Ads API:** APIs & Services → Library → search "Google Ads API" → **Enable**. **This step is easy to forget** — without it, the API returns 403 with a "this API has not been used in your project" error.
4. **Configure OAuth consent screen:**
   - APIs & Services → OAuth consent screen
   - User Type: **External** (Internal only works if `seifdn.org` is on Google Workspace, which it isn't)
   - App name: `Zilla HQ Ads API`
   - Support email + Developer contact: `jack@seifdn.org`
   - Test users: add `jack@seifdn.org`
   - Publishing status: **Testing** (don't publish — only the allowlisted Test User can authorize)
5. **Create OAuth Client:**
   - Credentials → + Create Credentials → OAuth client ID
   - Application type: **Desktop app** (not Web app — Desktop uses loopback redirects, ideal for one-shot CLI minting)
   - Name: `zilla-hq-cli`
   - Create → save the **Client ID** and **Client Secret** (the Secret is shown once — re-fetch from Credentials page later if lost)

### 2.4 Mint the refresh token

Refresh tokens are long-lived (don't expire unless revoked) and stored in the merchant's Vercel env. They authorize all subsequent API calls.

Run the included script:

```bash
GOOGLE_ADS_CLIENT_ID=<paste from §2.3> \
GOOGLE_ADS_CLIENT_SECRET=<paste from §2.3> \
  npx tsx scripts/google-ads-mint-refresh-token.ts
```

What happens:
1. Spawns a local server on a random port (loopback redirect)
2. Opens your default browser to Google's OAuth consent page
3. Browser shows "Google hasn't verified this app" — click `Advanced → Continue to Zilla HQ Ads API (unsafe)`. Expected for Testing-mode apps.
4. Sign in as the Zilla HQ Google account, approve the `adwords` scope
5. Browser redirects to `localhost:PORT`, script captures the code, exchanges for refresh token
6. Terminal prints `GOOGLE_ADS_REFRESH_TOKEN=1//...`

> ⚠️ **"No refresh token returned"** — Google only returns a refresh token on the *first* consent for an OAuth client + user pair. If you've already authorized this client before (e.g., during testing), revoke at https://myaccount.google.com/permissions and re-run the script.

Save the refresh token in 1Password / Vault. It's a bearer credential — treat it like a password. It does NOT need to be rotated per merchant; the same refresh token works across all merchant ad accounts under the MCC.

### 2.5 Verify with the smoke test

```bash
GOOGLE_ADS_DEVELOPER_TOKEN=<from §2.2> \
GOOGLE_ADS_CLIENT_ID=<from §2.3> \
GOOGLE_ADS_CLIENT_SECRET=<from §2.3> \
GOOGLE_ADS_REFRESH_TOKEN=<from §2.4> \
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<MCC ID from §2.1> \
GOOGLE_ADS_CUSTOMER_ID=<any ad account under the MCC> \
  npx tsx scripts/google-ads-smoke-test.ts
```

Expected output:

```
1. Minting access token from refresh_token... ✓
2. Listing accessible customers... ✓ N customer(s)
     • <MCC ID>
     • <each linked ad account>
3. Calling <ad account ID> via MCC <MCC ID>... ✓
     • Name: <ad account name>
     • Currency: USD
     • Time zone: America/New_York
✓ All credentials valid. Marketing API ready.
```

If step 2 succeeds but step 3 fails with `DEVELOPER_TOKEN_NOT_APPROVED`, you're still on Test access — the Basic Access application hasn't been processed yet. See §2.2.

---

## 3. Per-merchant setup (do this ONCE per portfolio brand)

Once Zilla HQ has done §2, each new merchant only needs these steps. Approximately 10 minutes per merchant.

### 3.1 Create a Google Ads ad account for the merchant

1. From the **Zilla HQ MCC dashboard** → Accounts (left sidebar) → **+** button → **Create new account**
2. Name: e.g. `Restay`, `Realscale`, `<merchant brand>`
3. Country: United States, Currency: USD, Time zone: America/New_York (or whatever matches)
4. **The new account is automatically linked to the MCC** (no separate link request needed when created from the MCC).
5. Note the new ad account's **Customer ID** (10 digits, no dashes)

### 3.2 Set the merchant's env vars

In the merchant's Vercel project (and `.env.local`):

```bash
# === Reused across all Zilla HQ merchants — copy from a sibling merchant's env ===
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<Zilla HQ MCC ID from §2.1>
GOOGLE_ADS_DEVELOPER_TOKEN=<from §2.2>
GOOGLE_ADS_CLIENT_ID=<from §2.3>
GOOGLE_ADS_CLIENT_SECRET=<from §2.3>
GOOGLE_ADS_REFRESH_TOKEN=<from §2.4>

# === Merchant-specific ===
GOOGLE_ADS_CUSTOMER_ID=<the new ad account ID from §3.1>
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXXX  # see §3.3
```

The first 5 vars are identical across every Zilla HQ merchant. Only `GOOGLE_ADS_CUSTOMER_ID` and `NEXT_PUBLIC_GOOGLE_ADS_ID` differ per merchant.

### 3.3 Get the merchant's gtag conversion ID (`AW-...`)

This is *separate* from the Customer ID. The `AW-` prefix is the merchant's conversion-tracking identifier, used by `gtag.js` on the merchant's marketing site.

1. From the merchant's **ad account** (not the MCC), Tools → Conversions → New
2. Source: Website
3. Goal: Purchase
4. Value: "Use different values for each conversion"
5. Count: One per click
6. Click-through window: 30 days
7. Save → "Set up the conversion" → choose **"Set up manually using code"** → Google shows a snippet starting with `AW-XXXXXXXXXX`
8. **The `AW-XXXXXXXXXX` portion** is `NEXT_PUBLIC_GOOGLE_ADS_ID`. Set it in Vercel env (Production + Preview).

The template's `components/marketing/ad-pixels.tsx` auto-injects `gtag.js` whenever `NEXT_PUBLIC_GOOGLE_ADS_ID` is set. No code changes needed.

### 3.4 Launch the branded-defense campaign

#### 3.4a Pre-Basic Access (manual UI) — works today

Follow [GOOGLE_ADS_OPERATOR.md](./GOOGLE_ADS_OPERATOR.md). Approximately 30 minutes of clicking through the Ads UI. The campaign created this way is identical to what the launch script produces.

#### 3.4b Post-Basic Access (programmatic) — once approved

```bash
# In the merchant repo:
npx tsx scripts/google-ads-launch-branded.ts
```

Reads `GOOGLE_ADS_CUSTOMER_ID` from env, creates everything in one mutate-with-temp-resources call:
- Campaign budget ($2/day)
- Search campaign with Search-only network, US-only targeting, Manual CPC max $1.50
- Single ad group
- 5 exact-match keywords + 1 phrase-match (the brand name + variants)
- Responsive Search Ad (15 headlines + 4 descriptions + display path)
- Sitelinks (4) + Callouts (8)
- Final URL suffix (UTMs)
- Conversion action linked to URL pattern `/delivery/`

Edit the constants at the top to customize per merchant:

```ts
const BRAND = "Restay";
const DOMAIN = "restay.agency";
const PURCHASE_URL_PATH = "/delivery/";
const DAILY_BUDGET_CENTS = 200;       // $2/day
const MAX_CPC_CENTS = 150;            // $1.50 ceiling
const KEYWORDS_EXACT = ["restay", "restay agency", "restay airbnb"];
const KEYWORDS_PHRASE = [`"restay.agency"`];
const HEADLINES = [...];   // 15 short headlines, 30 chars max each
const DESCRIPTIONS = [...]; // 4 descriptions, 90 chars max each
const SITELINKS = [...];   // 4 sitelinks
const CALLOUTS = [...];    // 8 callouts
```

Output: `campaign_id`, `ad_group_id`, `conversion_action_id`. Save the IDs in env:

```bash
GOOGLE_ADS_BRANDED_CAMPAIGN_ID=<campaign_id>
GOOGLE_ADS_BRANDED_AD_GROUP_ID=<ad_group_id>
GOOGLE_ADS_BRANDED_LAUNCH_DATE=2026-05-06
```

**The campaign starts PAUSED.** Spot-check in the Ads UI before unpausing.

---

## 4. Conversion tracking implementation

The template ships gtag injection in `components/marketing/ad-pixels.tsx`. Once `NEXT_PUBLIC_GOOGLE_ADS_ID` is set, the page-level config tag fires on every page view.

### 4.1 URL-based conversion tracking (works at $50/mo budget — recommended baseline)

Set up the conversion action in the Ads UI (§3.3) with **destination URL pattern matching `/delivery/`**. Google counts every visitor reaching that path as a Purchase conversion.

Pros: Zero additional code. Works the moment `NEXT_PUBLIC_GOOGLE_ADS_ID` is in env. Counts conversions accurately.
Cons: Doesn't track the per-order *value* ($79 vs $129 vs $149). At $50/mo budget the value-blindness is fine.

### 4.2 Event-level conversion tracking with value (upgrade later)

For value-tracking, the template ships `lib/google-ads-conversion.ts`:

```ts
import { trackGoogleAdsPurchase } from "@/lib/google-ads-conversion";

// On the /delivery/[orderId] page, after confirming paid:
trackGoogleAdsPurchase({
  conversionLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL!,
  value: order.amountCents / 100,
  currency: "USD",
  transactionId: order.id, // dedupe
});
```

The `conversionLabel` is the part AFTER the slash in your full conversion ID — for `AW-12345/abcDEFghi`, it's `abcDEFghi`. Get it from the Conversions page → click your Purchase action → "Tag setup" → "Use Google Tag Manager or install the tag yourself."

Set `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` in env. Wire `trackGoogleAdsPurchase` into your `/delivery/[orderId]` page or your Stripe webhook.

### 4.3 Server-side conversion uploads (offline conversions)

For high-value or delayed-attribution flows (lead → call → contract weeks later), Google supports server-side conversion uploads via the Click Conversion Upload API. Not implemented in v1 of the template; revisit when needed.

---

## 5. Auto-scaler — the budget algorithm

The template ships `inngest/functions/google-ads-budget-scaler.ts` — runs daily at 1:30am UTC. **Stateless math: each run derives target budget from days-since-launch + last-7d ROAS.**

### 5.1 Branded defense schedule

Branded defense doesn't scale with budget. Once you're capturing 100% of branded search volume, more budget doesn't help. The scaler:

- **Days 0–7:** hold at $2/day, observe
- **Day 7+:** if `daily_spend / daily_budget > 0.9` (you're hitting cap), bump 50% to $3/day. Repeat weekly until you stop hitting cap.
- **Cap:** never exceed `$10/day` for branded defense — if your brand is generating that much search volume, you've outgrown branded-defense and should add a category Search campaign

### 5.2 Category Search schedule

Category Search scales differently:

- Day 0: launch budget (default $20/day)
- Day 3: +20% if last-3d CAC ≤ ceiling ($30 default for one-time-fee merchants)
- Day 6: +20% if same condition holds
- Cap: `$200/day` (≈$6k/mo) — beyond this needs a media buyer

Same `target = INITIAL × 1.2 ^ floor(days / 3)`, capped at `MAX`.

### 5.3 Pause-on-CAC-breach

For category Search, pause if 7d CAC > ceiling **after $50+ of spend**:

```
Day 0–13:  ceiling = $40   (loose, let Google learn)
Day 14+:   ceiling = $25   (steady-state economics)
```

### 5.4 Configure

```bash
# Branded defense (almost always set-and-forget; defaults are fine)
GOOGLE_ADS_BRANDED_CAMPAIGN_ID=12345678901
GOOGLE_ADS_BRANDED_LAUNCH_DATE=2026-05-06
GOOGLE_ADS_BRANDED_INITIAL_BUDGET_CENTS=200
GOOGLE_ADS_BRANDED_MAX_BUDGET_CENTS=1000
CRON_GOOGLE_BUDGET_SCALER_ENABLED=true
```

### 5.5 Smoke-test before deploying changes

`scripts/google-ads-test-budget-scaler.ts` — read-only. Prints what the scaler **would** do today without actually updating the campaign:

```bash
npx tsx scripts/google-ads-test-budget-scaler.ts
```

---

## 6. Common errors and their fixes

| Error | What's actually wrong | Fix |
|---|---|---|
| `The API Centre is only available to manager accounts` | You're trying to apply for the developer token from a regular ad account, not from an MCC | Create an MCC (§2.1), link the ad account to it, apply from MCC |
| `DEVELOPER_TOKEN_NOT_APPROVED` on real ad accounts (despite Test access being granted) | Test access only works on sandbox test accounts, not real ones | Apply for Basic Access (§2.2). 1 business day approval. |
| `Google Ads API has not been used in project NNNNNNNNNN before or it is disabled` | Google Ads API isn't enabled on the Cloud project that owns your OAuth client | Cloud Console → APIs & Services → Library → Google Ads API → Enable. Wait 60s for propagation. |
| HTTP 404 on `/v17/customers:listAccessibleCustomers` (or any old version) | API version is sunsetted | Use **`v20`** (current as of May 2026). Bump `GOOGLE_ADS_API_VERSION` env. |
| `OAUTH_TOKEN_INVALID` | Refresh token revoked, scope wrong, or client_id/secret mismatch | Regenerate refresh token via §2.4. Confirm scope is `https://www.googleapis.com/auth/adwords`. |
| `CUSTOMER_NOT_FOUND` | Customer ID format wrong | 10 digits with no dashes. Don't include `customers/` prefix. Don't copy-paste with `act_` (that's Meta-style). |
| `MUTATE_ERROR: PolicyViolationError` on RSA | Ad copy violates Google policy (often false positive) | Most common: superlatives ("best," "#1") trigger this. Soften copy and resubmit. |
| `INVALID_ARGUMENT: The bid is too high for your budget` | Manual CPC > daily budget × 0.5 | Lower max CPC, or raise budget |
| `RESOURCE_NOT_FOUND` on conversion action | Conversion ID format wrong | Use only the part AFTER `AW-` for `conversion_action_id`. For `AW-12345/abcDEF`, the resource is `customers/{cid}/conversionActions/abcDEF`. |
| Ad stuck in `UNDER REVIEW` >24h | Account-level review (typical for new accounts) | Verify domain ownership in Ads UI, attach a real privacy policy, contact support |
| Conversion not firing on Purchase | Either gtag not loaded OR conversion label mismatch | Open prod page → DevTools → check for `googleadservices.com/pagead/conversion/AW-XXX/abcDEF` request firing |
| `CONVERSION_ACTION_NOT_FOUND` on conversion upload | Conversion action exists but isn't in the customer you're calling | Conversion actions are scoped to a single Customer ID. Don't share across MCCs without explicit linking. |
| `Performance Max` keeps appearing on campaign create | Google's UX defaults to PMax | Click "view other campaign types" link → choose Search. PMax is rarely the right choice for $50–500/mo budgets. |
| Recommended daily budget shows `$22.10` but you set `$2/day` | Google's "recommended" is always optimistic | Click "Set custom budget" and ignore Google's recommendation. Branded defense rarely spends >$2/day in real traffic. |
| Locations defaults to "Caroline County, Delaware" or wherever you happen to be | Google auto-detects from your IP | Wipe it, type "United States," select country-level |

---

## 7. Operating playbook

### Branded defense (set-and-forget)
- Day 0: launch (paused), unpause once `UNDER REVIEW` clears (~30-60 min)
- Week 1: verify ads served, conversion firing
- Monthly: glance at spend (should be well under cap), CTR (>10% on branded keywords is normal), conversions (any visitor who already knew the brand)
- Year 1: revisit only if your brand search volume grows materially

### Category Search (active management)
- Day 0–7: don't panic, no early kill
- Day 14: review keyword-level CAC. Negative-keyword anything with high CTR but no conversions
- Refresh 8–10 RSA headlines every 6 weeks based on which combos Google rotated highest
- Quarterly: prune zero-volume keywords, add new variants discovered from Search Terms report

### Kill criteria (write these down)
- Keyword: 0 conversions after $50 spent → add as negative
- RSA headline: rotated <5% by Google over 30 days → swap with a new variant
- Sitelink: <1% CTR over 30 days → remove

---

## 8. Token security

- **Never commit tokens to git.** `.env.local` is gitignored; use that for local development.
- **Refresh tokens are bearer credentials.** If exposed, revoke at https://myaccount.google.com/permissions and re-mint via §2.4.
- **Developer token** can be regenerated from API Center at any time. Old tokens stop working immediately on regen — coordinate across all merchants if rotating.
- **Conversion IDs (`AW-...`) are public** — they're injected in your gtag and visible to anyone viewing source. The conversion *label* is also public. There's no security boundary here; controls live in the conversion-action settings (count, value rules, attribution window).

---

## 9. Going beyond branded defense

When a merchant outgrows branded defense:
- **Category Search campaign** — duplicate the launch script, swap KEYWORDS_EXACT for category terms ("airbnb listing optimizer", "real estate photo enhancement"). Higher budget, tighter kill criteria.
- **YouTube placements** — `advertising_channel_type=VIDEO`. Targets specific creator channels (Sean Rakidzich, Robuilt for STR; Brandon Mulrenin, Ricky Carruth for RE). Direct-host-intent traffic.
- **Customer Match** — once you have ≥1k email list members (paid customers + partner-referred leads), upload as Customer Match audience for retargeting.
- **Smart bidding** — once category Search has ≥30 conversions/month, switch from Manual CPC to Target CPA. Don't switch earlier — auto-bidding underperforms manual at low conversion volumes.

---

## 10. Files in this template

> **Status column** is honest about what's actually shipped vs still on the
> roadmap. SiteGrid (the second Zilla HQ portfolio merchant to wire this up)
> backported the canonical launch script in May 2026; the runtime layer
> (`lib/google-ads.ts`, Inngest cron, gtag component) is still TODO and
> tracked at the bottom of this section.

| File | Status | Purpose |
|---|---|---|
| `GOOGLE_ADS.md` | ✅ shipped | This doc — engineer runbook |
| `GOOGLE_ADS_OPERATOR.md` | ✅ shipped | Sub-company operator's day-to-day playbook |
| `docs/google-ads-design-doc-template.md` | ✅ shipped | Template for Basic Access application's design doc |
| `scripts/google-ads-mint-refresh-token.ts` | ✅ shipped | One-shot OAuth flow → refresh token (§2.4) |
| `scripts/google-ads-smoke-test.ts` | ✅ shipped | Read-only credential validator (§2.5) |
| `scripts/google-ads-launch-branded.ts` | ✅ shipped | Programmatic branded-defense campaign launch (§3.4b — requires Basic Access). Single-mutate atomic create of budget + campaign + ad group + keywords + RSA. |
| `scripts/google-ads-test-budget-scaler.ts` | ⚠️ TODO | Read-only dry-run of the budget scaler. Depends on `lib/google-ads.ts` for budget-read API; can be inlined when written. SiteGrid has a working version at `script/google-ads-test-budget-scaler.ts` in its repo. |
| `lib/google-ads.ts` | ⚠️ TODO | Thin REST client around `googleads.googleapis.com`. Should expose: `mintAccessToken`, `searchStream`, `mutate`, `getCampaignBudget`, `updateCampaignBudget`, `updateCampaignStatus`. SiteGrid's repo has a working equivalent at `server/services/google-ads.ts`. |
| `lib/google-ads-conversion.ts` | ⚠️ TODO | Browser-side helper for value-tracking gtag events |
| `inngest/functions/google-ads-sync.ts` | ⚠️ TODO | Hourly metrics sync (Insights → admin dashboard). Mirror the pattern in `inngest/functions/meta-ads-sync.ts`. |
| `inngest/functions/google-ads-budget-scaler.ts` | ⚠️ TODO | Daily budget scaler. SiteGrid has the algorithm + cron at `server/cron/google-ads-budget-scaler.ts` — port the `computeBrandedTargetBudget` pure function as-is and wrap with the Inngest scheduled-function pattern from `meta-ads-lead-scaler.ts`. |
| `components/marketing/ad-pixels.tsx` | ⚠️ TODO | gtag injection (auto when `NEXT_PUBLIC_GOOGLE_ADS_ID` is set) |
| `components/admin/google-ads-panel.tsx` | ⚠️ TODO | Admin dashboard read-only insights panel |

**TODO breakdown for next merchant to onboard:** the launch-branded script is sufficient for the manual side of campaign creation, but the autonomy layer (auto-budget-scaling, hourly sync into the admin dashboard, gtag value-tracking) is still on TODO. Ship them as a single PR by:

1. Port `server/services/google-ads.ts` from the SiteGrid repo to `lib/google-ads.ts` (Next.js-flavored — replace Express response types with bare functions).
2. Port `server/cron/google-ads-budget-scaler.ts` to `inngest/functions/google-ads-budget-scaler.ts` (wrap with `inngest.createFunction` like `meta-ads-lead-scaler.ts`).
3. Port `server/cron/google-ads.ts` (sync + autonomy) to `inngest/functions/google-ads-sync.ts` + `inngest/functions/google-ads-autonomy.ts`.
4. Add `components/marketing/ad-pixels.tsx` that returns a `<Script>` block when `NEXT_PUBLIC_GOOGLE_ADS_ID` is set (see SiteGrid's `client/index.html` for the conditional gtag pattern, port to React).
5. Add `lib/google-ads-conversion.ts` exporting `trackGoogleAdsPurchase({ conversionLabel, value, currency, transactionId })` that pushes to `window.dataLayer`.

---

## TL;DR for the impatient

1. **Zilla HQ one-time setup (§2):** create MCC, apply for Basic Access (1 business day), create Cloud project + OAuth client, mint refresh token.
2. **Per-merchant setup (§3):** create ad account inside MCC, set 7 env vars (5 reused + 2 merchant-specific), get the `AW-` gtag ID for value tracking.
3. **Pre-Basic Access:** launch branded defense via the manual UI (see GOOGLE_ADS_OPERATOR.md).
4. **Post-Basic Access:** `npx tsx scripts/google-ads-launch-branded.ts` does it programmatically in 30 seconds.
5. **Inngest crons handle the rest:** budget scaling, hourly metrics sync.
6. **Don't panic before day 7.** Branded defense usually has ~1–5 clicks/week.
