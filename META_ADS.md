# Meta Ads — full runbook

> Distilled from launching a real campaign end-to-end. Every gotcha here cost real time to discover; following this top-to-bottom should let you launch in **~2 hours** instead of two days.

This is the operator's manual for paid acquisition on Meta (Facebook + Instagram). The template ships with Pixel + Conversions API + Marketing API integration; this doc is **how to actually run it.**

> **Are you a Zilla sub-company operator?** Don't read this doc top-to-bottom — paste [**SUB_CO_META_ONBOARDING_PROMPT.md**](./SUB_CO_META_ONBOARDING_PROMPT.md) into Claude and follow the conversational walkthrough. It hardcodes the Zilla parent BP context (so Claude won't try to create a new one), asks one diagnostic question at a time, then steps through child-asset creation under the parent BP → Vercel env wiring → Pixel/CAPI verification → AEM → first campaign launch. The prompt cites this doc at the campaign-launch step (§5–§9) so you'll still end up here for the playbook details.
>
> **Platform side (Polsia model):** This runbook covers a **single merchant's** ad account. For the Zilla-platform Polsia model — one parent Business Portfolio with child ad accounts per sub-company, ad-credit ledger pre-funding spend, and an AI agent operating across all of them — start with [**ZILLA_HQ_SETUP_META.md**](./ZILLA_HQ_SETUP_META.md) (the one-time parent-BP setup + the §8 autonomous flow that mints child Page + IG + ad account + Pixel for every new sub-co). Deep-dive spec: [`architecture/docs/01a-meta-sub-company-replication.md`](./architecture/docs/01a-meta-sub-company-replication.md) (the exact 14-step replication procedure with API payloads, engineer + operator split, and current Day-0 status). Background: [`architecture/docs/01-ad-network-setup.md`](./architecture/docs/01-ad-network-setup.md) (multi-network parent provisioning) and [`architecture/docs/02-payments-and-ledger.md`](./architecture/docs/02-payments-and-ledger.md) (Stripe Connect + ad credits). **If you're operating one standalone merchant (not a Zilla sub-co), you don't need those — read on.**

---

## 0. When NOT to use this

Paid social is **not an immediate-revenue lever.** Meta's algorithm needs ~7-14 days of learning before optimization stabilizes — first sales realistically arrive day 5-10, stable economics around day 14-21. If you need revenue this week, work the cold-email pipeline first. Paid social is the **durable scale engine** you build behind it.

---

## 1. Architecture overview

```
┌────────────────┐    fbq("track", "Lead", ...)      ┌────────────────┐
│  Browser       │ ─────────────────────────────────▶│  Meta Pixel    │
│  (Next.js page)│                                   │                │
└──────┬─────────┘                                   └────────────────┘
       │
       │  POST /api/checkout, /api/lead, etc.                   ▲
       ▼                                                        │ matches by event_id
┌────────────────┐    sendCapiEvent({ Lead })        ┌────────────────┐
│  Server route  │ ─────────────────────────────────▶│  CAPI          │
│  (lib/meta-    │  (high match: IP + UA + email +   │  graph.facebook│
│   capi.ts)     │   phone + _fbp + _fbc, all hashed)│  .com/<pixel>  │
└────────────────┘                                   └────────────────┘
                                                              │
                       ┌──────────────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────────────┐
       │  Meta Ads optimization — finds     │
       │  more users likely to fire Lead    │
       │  events, drives them to the site   │
       └─────────────┬──────────────────────┘
                     │
                     ▼
       ┌────────────────────────────────────┐
       │  Inngest crons (this template):    │
       │  • meta-ads-sync       hourly      │
       │  • meta-ads-autonomy   1am UTC     │
       │  • meta-lead-scaler    1:30am UTC  │
       │  • meta-fatigue-check  9am UTC     │
       └────────────────────────────────────┘
```

The template gives you the **plumbing** (Pixel + CAPI + Marketing API + autonomy crons). This doc tells you how to **wire it to your specific Meta Business Portfolio** so it actually works.

---

## 2. One-time Meta setup (~30 min, sequential)

Do these in order. Each step blocks the next.

### 2.1 Business Portfolio + Ad account + Page + Pixel

If you don't already have these, create them in **[Meta Business Suite](https://business.facebook.com)**:
- **Business portfolio** — top-level container; everything else is owned by this
- **Ad account** — where your campaigns live (e.g. "Acme Ads")
- **Facebook Page** — every ad runs "from" a Page; create one matching your brand
- **Pixel (Dataset)** — Business Settings → **Data Sources** → **Datasets and pixels** → Add → name it (e.g. "Acme Pixel")

Note the **Pixel ID** (numeric) — you'll need it for `NEXT_PUBLIC_META_PIXEL_ID`.

### 2.2 Meta App — flip from Development to Live

If your app (the one that owns your tokens) is in Development mode, **you cannot create ad creatives that share API-uploaded posts.** Most ad-creative API errors trace back to this.

1. https://developers.facebook.com/apps → click your app
2. Settings → Basic → fill these:
   - **Privacy Policy URL** — must return 200 + show a real privacy policy (the template has a `/privacy` route — see "Privacy policy" section below)
   - **App Icon** — 1024×1024 PNG
   - **Category** — "Business and Pages"
   - **Data Deletion URL or Instructions** — for B2B SaaS, "Email hello@<domain>" works
3. Save → top of dashboard: flip **App Mode: Development → Live**

**Live mode does NOT require Meta App Review** for advertising-only use cases. It only requires the basic info above.

### 2.3 System User + token (the one your server uses)

Why a System User and not a regular user token: **System User tokens never expire.** User tokens expire in 1-2 hours.

1. Business Settings → **Users** → **System Users** → **Add**
2. Name it `<merchant>-server`, role **Admin** → Create
3. **Add Assets** to this System User — assign all four:
   - **Ad accounts** → your ad account → toggle **Manage campaigns**
   - **Pages** → your Page → toggle **Create content** (or **Manage Page** if you want full control)
   - **Datasets and pixels** → your Pixel → toggle **Manage Pixel** (Track-only is NOT enough for ads optimization)
   - **Apps** → your app → toggle **Develop app**
4. **Generate New Token** → select your app → check these scopes (all required):
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_manage_posts`
   - `pages_read_engagement`
5. Copy the token → set as `META_ADS_ACCESS_TOKEN`

### 2.4 Pixel ↔ ad account link

Even with a System User assigned to both, the **Pixel itself must be connected to the ad account** for ads to use it for optimization.

1. Business Settings → **Data Sources** → **Datasets and pixels** → click your Pixel
2. **"Connected assets"** tab → **Add Assets** → Ad Accounts → select your ad account
3. **Toggle "Manage Pixel"** (NOT just "Track" — Track alone causes "Account does not have access to pixel" errors at ad-creation time)
4. Save

**To do via API instead:**
```bash
# Required: business_management scope on token
curl -X POST "https://graph.facebook.com/v19.0/<PIXEL_ID>/shared_accounts" \
  -d "business=<BUSINESS_ID>" \
  -d "account_id=<AD_ACCOUNT_ID>" \
  -d "access_token=$META_ADS_ACCESS_TOKEN"
```

> ⚠️ The API path defaults to **Track-only** access. To get Manage, set it via UI or use the explicit task assignment endpoint. If your ads later flag "Unassociated pixel", upgrade to Manage in the UI.

### 2.5 Conversions API token (separate from Marketing API token)

CAPI uses its own token, not your System User token.

1. Events Manager → your Pixel → **Settings** → **Conversions API** → **Generate access token**
2. Set as `META_CONVERSIONS_API_TOKEN`

### 2.6 Test Events code (for verification)

1. Events Manager → your Pixel → **Test Events** tab
2. Enter a URL of your dev/staging site — Meta gives you a `TEST<NNNNN>` code
3. Set as `META_TEST_EVENT_CODE` (optional; enables test mode)

---

## 3. Pixel + CAPI implementation

The template ships these — this section explains the **decisions** baked in.

### 3.1 What events to fire (and where)

| Funnel stage | Event name | Where it fires | Why |
|---|---|---|---|
| Page load | `PageView` | browser pixel | Free, baseline |
| Sample preview viewed | `ViewContent` | browser pixel | Engagement signal, low intent |
| (Custom) builder opened | `BuilderOpened` *(custom)* | `fbq("trackCustom", ...)` | Funnel measurement only — too early to optimize on |
| **Real intent** (e.g. business identified) | **`Lead`** | browser **+** server (CAPI) | **Optimization target for OUTCOME_LEADS** |
| Stripe checkout started | `InitiateCheckout` | server (CAPI) | Real purchase intent. Has email + phone — high match quality |
| Purchase completed | `Purchase` | server (CAPI, on Stripe webhook) | **Optimization target for OUTCOME_SALES** (once you have ≥50/wk) |

### 3.2 Browser pixel — the `trackCustom` gotcha

Meta's `fbq("track", X, ...)` **silently drops** events whose name isn't on its [standard events list](https://www.facebook.com/business/help/402791146561655). Custom events must use `fbq("trackCustom", ...)` instead.

The template ships this helper:

```ts
// app/lib/track-meta-event.ts (or your equivalent)
const STANDARD_META_EVENTS = new Set([
  "PageView", "ViewContent", "Search", "AddToCart", "AddToWishlist",
  "InitiateCheckout", "AddPaymentInfo", "Purchase", "Lead",
  "CompleteRegistration", "Contact", "CustomizeProduct", "Donate",
  "FindLocation", "Schedule", "StartTrial", "SubmitApplication", "Subscribe",
]);

export function trackMetaEvent(name: string, params?: Record<string, any>) {
  const fbq = (window as any).fbq;
  if (typeof fbq !== "function") return;
  if (STANDARD_META_EVENTS.has(name)) fbq("track", name, params || {});
  else fbq("trackCustom", name, params || {});
}
```

**Always use this helper.** Direct `fbq("track", "MyCustomEvent", ...)` will silently fail.

### 3.3 Browser ↔ server dedupe

When the same action fires both browser and server (e.g. checkout-start), pass a shared `event_id` so Meta dedupes:

```ts
// browser
const eventId = crypto.randomUUID();
trackMetaEvent("InitiateCheckout", { eventId, ... });
fetch("/api/checkout", { body: JSON.stringify({ eventId, ... }) });

// server (lib/meta-capi.ts already supports this)
sendCapiEvent({ eventName: "InitiateCheckout", eventId, ... });
```

Without matching `event_id`, Meta double-counts, which inflates your reported conversions and breaks CAC math.

### 3.4 Don't conflate funnel stages under one event name

Anti-pattern we hit and fixed: firing `InitiateCheckout` browser-side on "place picked" AND server-side on "Stripe checkout started." Same event name, different funnel stages → Meta optimizes on the cheaper-to-fire one (place-picks), not the more valuable one (real Stripe starts), because it sees ~10× more place-picks.

**Rule:** one funnel stage = one event name. Use `Lead` for top-of-funnel real intent, `InitiateCheckout` strictly for Stripe checkout starts, `Purchase` strictly for completed checkouts.

### 3.5 Verify with Test Events

The template has `scripts/meta-capi-verify.ts` — fires one of each event type and confirms they appear in your Pixel's Test Events tab.

```bash
npx tsx scripts/meta-capi-verify.ts TEST<NNNNN>
```

You should see all events appear within ~30s with their match quality scores. **Run this before every prod deploy** that changes CAPI logic.

---

## 4. Privacy policy + app icon (required for Meta app Live mode)

The template ships a `/privacy` page. Verify it works at `https://<your-domain>/privacy` before submitting to Meta.

For a 1024×1024 app icon — `scripts/make-icon.py` generates a clean monogram. Or use any PNG you have. Meta accepts PNG/JPG, no transparency required.

---

## 5. Campaign launch playbook

This is the order of operations for going from "I have a Pixel set up" to "ads are running."

### 5.1 Decide your optimization event

Don't optimize on a low-volume event — Meta needs ~50 events/week per ad set to exit learning phase. Working backwards:

| Have ≥50/week of... | Optimize on | Campaign objective |
|---|---|---|
| Purchases | `Purchase` | `OUTCOME_SALES` |
| Leads / qualified intent | `Lead` | `OUTCOME_LEADS` |
| Anything noisy at top of funnel | (don't) | (start with OUTCOME_LEADS, build to OUTCOME_SALES) |

> ⚠️ Meta v19+ **enforces objective ↔ event match.** You cannot optimize on `LEAD` with `OUTCOME_SALES`. The API returns "Conversion event unavailable." Match them.

For most new merchants: **start with OUTCOME_LEADS** until volume justifies OUTCOME_SALES.

### 5.2 Campaign structure (the one we run)

```
Campaign  (CBO — Campaign Budget Optimization, $75/day starting)
├─ Ad Set A — Advantage+ broad
│   targeting: { geo, age 25+, targeting_automation: { advantage_audience: 1 } }
│   no interests — let Meta cook
└─ Ad Set B — interest stack
    targeting: { geo, age 28+, targeting_automation: { advantage_audience: 0 },
                 flexible_spec: [{ interests: [Wix, Squarespace, GoDaddy, ...] }] }
    advantage_audience: 0 — strict, don't expand past these interests
```

Why two ad sets: you're testing **broad vs. interest** as audience hypotheses. Same creatives in both. Meta picks winners by ad set.

> ⚠️ **`targeting_automation.advantage_audience` is now required.** Meta v19 rejects ad sets with `flexible_spec` (interests) unless you explicitly set `advantage_audience: 0` or `1`. Set 1 to let Meta expand past your interests; set 0 to keep it strict. Errors look like: `Advantage Audience Flag Required`.

### 5.3 Launch programmatically

Use `scripts/meta-launch-campaign.ts`. One command creates the campaign + 2 ad sets, all PAUSED.

```bash
npx tsx scripts/meta-launch-campaign.ts
# prints campaign_id, adset_a_id, adset_b_id
```

Save those IDs into env vars (`META_LEAD_CAMPAIGN_ID` etc.) — the auto-scaler reads them.

### 5.4 Creative — the demo IS the ad

The strongest creative for a personalized-product merchant is a **screen recording of the product working on a real customer's data**. The "wait, that's mine" moment is irreplaceable. Generic stock-image ads in this category get crushed by personalized demos.

Specs:
- **Vertical 9:16** (1080×1920 ideal) for Reels/Stories
- 15-30 seconds
- No voiceover required — Meta strips audio anyway, viewers watch muted
- 1080p, H.264, MP4 (`.mov` works but transcode to MP4 with `ffmpeg` for reliability)

For the first creative: **screen-record yourself** doing the magic moment. Don't try to film 6 ads on day 1 — one banger beats six mediocre.

### 5.5 Video upload — chunked, NOT single

> 🚨 **Critical:** the simple `/act_<id>/advideos` endpoint **hangs in "uploading" status forever** for System User tokens. Do not use it. Documented Meta-internal limitation.

Use the **chunked upload protocol** to `/<page_id>/videos` instead. The template has `scripts/meta-upload-page-video.ts`:

```bash
npx tsx scripts/meta-upload-page-video.ts ./creative-v1.mp4
# prints video_id when ready
```

The video uploads as an **unpublished page post** (won't appear on your Page timeline; usable only in ads).

### 5.6 Create ad creatives + ads

Use `scripts/meta-create-ads.ts` — takes a video_id, creates N copy variants × M ad sets. Defaults to 4 variants × 2 ad sets = 8 ads, all PAUSED.

Edit the `VARIANTS` constant at the top of the script with your headline/primary/CTA copy:

```ts
const VARIANTS = [
  { slug: "v1_speed",     primary: "...", headline: "...", description: "...", cta: "LEARN_MORE" },
  { slug: "v2_anti_sub",  primary: "...", headline: "...", description: "...", cta: "SIGN_UP" },
  { slug: "v3_problem",   primary: "...", headline: "...", description: "...", cta: "GET_OFFER" },
  { slug: "v4_proof",     primary: "...", headline: "...", description: "...", cta: "LEARN_MORE" },
];
```

UTM tagging is automatic — `utm_source=meta&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<variant>_set<A|B>`.

### 5.7 Spot-check + unpause

1. **Verify in Ads Manager** — click each ad → Preview pane → confirm video plays, copy renders, CTA button correct, link goes to your domain with UTMs.
2. **Unpause IN ORDER** — campaign → ad sets → ads. Meta warns if you flip a child ACTIVE while the parent is PAUSED.
3. Most ads sit in `PENDING_REVIEW` for ~30-60 min. They start spending the moment Meta clears them. Don't refresh the page neurotically; check back in an hour.

---

## 5b. Case study — Restay's first paid customer (2026-05-06)

> **Read this section.** It documents the FIRST paid customer ever acquired through this template's Meta ads infrastructure — what worked, what broke, what was fixed, and which patterns to replicate. Every silent failure exposed by this run is now caught at the platform level for future merchants to inherit. Read it as both a marketing case study (yes, paid social converts vertical-SaaS leads at $30 CAC on a $79 product) and a postmortem (here's exactly how a paid customer was lost to silent failures, and how the template now prevents the same chain).

### TL;DR

- Restay (the airbnb merchant — listing optimization for hosts) launched paid acquisition on Meta on **2026-05-05**.
- **First paid customer arrived 2026-05-06 at 8:55 PM ET** — total ~30 hours from campaign first-serve.
- Effective CAC: **$30.30 on a $79 ASP** (38% of revenue) — the ad's lifetime spend, attributed entirely to the one customer who paid in that window.
- Click-to-paid time: **3 minutes** — customer pasted URL → saw preview → ordered.
- Customer **refunded 17 minutes later**. Cause: a chain of three platform silent failures, all now fixed at the template level.

The success and the postmortem are both instructive. Don't skip the failure-mode section — the bugs that bit Restay will bite any future merchant that forks this template, unless you inherit the fixes.

### 5b.1 The ad that converted

**Campaign:** `audit_v1` (OUTCOME_LEADS)
**Ad set:** A — Advantage+ broad US 25+
**Variant slug:** `v1_audit60s_setA`
**Meta ad ID:** `52544540990392`
**Creative ID:** `1556952862880234`
**Page-post ID:** `122099047281302699`

**👉 Public link to the actual ad** (no Meta login required — anyone can open it and see exactly what the customer saw in their Reels feed):

```
https://www.facebook.com/61589080980649/posts/122099047281302699/
```

When you share this URL with partners, course operators, podcast hosts, or in case-study writeups, the recipient sees the full ad post: the 22-second vertical video, the caption, the headline, the CTA button, and the destination URL.

**Creative:**

| Field | Value |
|---|---|
| Format | Vertical 9:16 video, ~22s |
| Subject | Phone-shot screen recording of pasting an Airbnb URL into restay.agency, the audit running, finishing on a free 60-second restyled-photo + comp-pricing scan |
| Primary text | "Your Airbnb listing is competing against 50+ comps in your area. Free 60-second audit shows what they're doing differently." |
| Headline | "Free Airbnb Listing Audit" |
| Description | "Paste your URL — get rewritten copy, restyled photo, and pricing comps in 60s." |
| CTA button | Learn More |
| Destination | `restay.agency/?utm_source=meta&utm_medium=paid_social&utm_campaign=audit_v1&utm_content=v1_audit60s_setA` |

**Audience:**

- Geo: United States only
- Age: 25-65
- Interests: **Advantage+ broad** — Meta's automated audience expansion, no explicit interest stack
- Optimization event: `Lead` (top-of-funnel real intent — `lib/meta-capi.ts` fires Lead from `/api/self-serve` when a host pastes their URL)

### 5b.2 Performance numbers

| Metric | Lifetime (2 days) |
|---|---|
| Spend | $30.30 |
| Impressions | 477 |
| Reach (unique people) | 390 |
| Clicks | 19 |
| **Avg CPC** | **$1.60** |
| **CTR** | **3.98%** |
| Frequency | 1.22 |
| CAPI Lead events | 1 (the eventual customer) |
| CAPI Purchase events (Meta-attributed) | 0 — Meta's reporting lag is 24-72h |

A 3.98% CTR on a cold-acquisition ad in the STR-host vertical beats the typical 1.5–3% benchmark. The phone-shot UGC video did most of that lift. **Do not over-polish creative — authentic reads better than studio.**

### 5b.3 The funnel — paid in 3 minutes

```
T+00:00  Customer clicks Meta ad on Reels
         → Lands on restay.agency/?utm_source=meta&utm_campaign=audit_v1&utm_content=v1_audit60s_setA
         → middleware.ts captures UTMs into restay_attr cookie
         → Pastes Airbnb URL into homepage form

T+01:24  Self-serve preview generation kicks off
         → /api/self-serve fires CAPI Lead
         → Customer redirected to /generating/[id], then /l/[listingSlug]

T+02:33  Customer clicks "Get the Tune-Up" on /l preview page
         → /api/checkout creates Stripe Checkout session
         → CAPI InitiateCheckout fires
         → Stripe Checkout opens

T+03:00  Customer completes payment ($79)
         → Stripe webhook checkout.session.completed
         → /api/stripe/webhook updates order status="paid"
         → CAPI Purchase fires
         → Inngest event orders/paid sent
```

**Three minutes from URL paste to paid charge.** This is what the "free 60-second audit" hook buys: the customer enters the funnel, sees what they're getting, and converts before the impulse cools.

### 5b.4 Why this funnel works (replicate this pattern)

Three factors converged. Replicate all three on future Zilla merchants:

1. **Free-tier hook delivers value before payment.** Most paid SaaS funnels demand a $79 commitment before the user sees output. We invert it: paste URL → see real restyled photo of YOUR listing + pricing comps → THEN decide. Drop the friction.

2. **Vertical-specific UGC video creative.** A phone-shot demo of someone pasting an Airbnb URL into the tool reads as authentic. 9:16 Reels placement reaches the same audience that's actively browsing Airbnb listings on their phone — peak intent overlap.

3. **One-time pricing eliminates subscription friction.** Restay competes against PriceLabs / Wheelhouse / Hospitable, all of which charge $20–40/month with credit-card commitment. We ask for $79 once, refund within 14 days. Lower psychological commitment, higher conversion.

### 5b.5 What broke — silent-failure postmortem

The customer paid but **refunded 17 minutes later**. Cause was three compounding silent failures. Each is now fixed at the platform level. Read these carefully — every one will bite future merchants unless you inherit the protections.

#### Bug 1 — Photo scraper grabbed Airbnb's cartoon review thumbnails instead of real listing photos

The pre-payment preview page showed two restyled images that looked like generic stylized cartoons (a peach gift box, a dramatic dark window view). These weren't the customer's A-frame cabin photos at all — they were **Airbnb's AI-synthesized review-summary thumbnails**, embedded in the listing page HTML at `/im/pictures/AirbnbPlatformAssets/AirbnbPlatformAssets-Review-AI-Synthesis/...` alongside the real listing photos at `/im/pictures/prohost-api/Hosting-<id>/...`.

The scraper's URL-pattern regex didn't distinguish between the two. Real listing photos are always at `/prohost-api/Hosting-<id>/` or `/miso/Hosting-<id>/`; everything else under `/AirbnbPlatformAssets/`, `/AirCover/`, `/Categories/`, `/badge/` is platform decoration that Airbnb embeds for its own UI.

The customer pasted his Airbnb URL, saw a peach gift box and a stylized window claiming to be his property, and reasonably concluded this was a scam. He paid $79 *anyway* (which speaks to the strength of the funnel hook), then refunded once he realized the deliverable would be more of the same.

**Fix:** in any merchant that scrapes a third-party listing surface, filter by **whitelisted asset path patterns** (the user-uploaded photo path), not blacklisted ones. If your scraper grabs `<img src>` or any image-URL regex, audit what the source platform serves alongside real assets. See airbnb fork's `lib/airbnb-direct.ts` photo extractor for the pattern.

#### Bug 2 — fal.ai exhausted credits mid-funnel and the pipeline failed silently

Sometime during the customer's payment day, fal.ai's account credits depleted (apparent cause: the Meta ad was driving more self-serve previews than budget anticipated). Every subsequent fal.ai call returned `403 "User is locked. Reason: Exhausted balance."` Inngest retried 2-3× per the function config, all failed, the function gave up. **No alert fired.** No customer notification. The order sat in `status='paid'` with `fulfilledAt=null` for 17 minutes until the customer refunded.

This is the most insidious failure mode in the template: a downstream provider goes broken, the pipeline keeps accepting work, customers pay into a black hole.

**Fix shipped (now in template):**

- `lib/provider-errors.ts` — heuristic detector for credit/quota/auth errors across fal.ai, Anthropic, Resend, OpenAI. Detects fal.ai's exact "Exhausted balance" + "User is locked" phrases (the actual strings we hit). Distinguishes credit_exhausted (sticky failure — pause pipeline) from rate_limited / service_outage (transient — let Inngest retries handle it).
- `lib/ops-alerts.ts` — `sendOpsAlert(severity, subject, body)` fires Resend transactional alert email to the operator within 5 minutes. 10-min in-process dedupe prevents inbox carpet-bombing during sustained outages.
- `inngest/functions/preview.ts` and `inngest/functions/fulfillment.ts` — when ALL provider calls fail, detect the error class. If credit_exhausted or auth_invalid, **auto-set `previewPaused=true` / `fulfillmentPaused=true` in `admin_settings`** so subsequent customers don't enter the broken funnel. Fire ops alert with full context (orderId, listingId, provider, error count).

#### Bug 3 — No "we got your order" email between Stripe payment and fulfillment delivery

The system had **no transactional confirmation** between the Stripe webhook firing and fulfillment delivering the ZIP. The customer paid $79, then sat in 17 minutes of complete silence with no signal that the order had been received. From the customer's view: paid, nothing happened, refunded.

**Fix shipped:** `lib/order-confirmation.ts` fires the moment `/api/stripe/webhook` flips order status to `paid`, **before fulfillment runs**. Personal voice ("Got your $79 order — payment landed and we're on it"), names the SLA explicitly ("ETA under 4 hours"), invites reply-back to the operator's inbox. Decoupled from fulfillment so a Resend outage can't suppress the receipt and a fulfillment failure can't delay it.

#### Bug 4 (compound) — No alarm on stuck-in-paid orders

The system had no detection for orders that paid successfully but never got fulfilled. **Fix shipped:**

- `inngest/functions/order-stuck-watchdog.ts` runs every 5 min. Finds orders WHERE `status='paid' AND fulfilledAt IS NULL AND paidAt < now() - 5min`. For each: re-fires `orders/paid` (idempotent — fulfillment.ts short-circuits if status already moved past `paid`) + emails the operator with full context.
- `inngest/functions/preview-stuck-watchdog.ts` is the twin for self-serve previews — finds listings >5min old without a preview row, retries + alerts. Together they cover both halves of the customer-loss surface.

### 5b.6 Recovery flow we ran on the refund

Within 1 hour of detecting the refund, we ran a personal recovery flow. Documenting because every refund is recoverable if you move fast:

1. **Trace the order** to identify the acquisition channel + listing → `scripts/trace-order-attribution.ts` (joins orders → listings → outreach_events → messages, prints the verdict)
2. **Inspect what was actually delivered** vs scoped → `scripts/inspect-order-deliverables.ts` (joins to previews + rewritten_copies + pricing_reports — surfaces the exact gap)
3. **Send a personal recovery email** with a 10% off discount code, expiring same-day → `scripts/recover-refunded-customer.ts` (creates a one-time Stripe coupon + promotion code, emails the customer with a one-click checkout link that auto-applies)
4. **After fixing the root cause**, send a follow-up email with the actual restyled image of one of the customer's photos + a "tell me what you want, I'll personally handle it" framing → `scripts/send-followup-with-sample.ts`

The discount-code auto-apply works via a `?promo=CODE` cookie that `middleware.ts` captures and `/api/checkout` reads + resolves to a Stripe `promotion_code` at session creation. The customer never has to type the code.

All scripts in the airbnb fork's `scripts/` directory; portable to merchant-template with minor schema renames.

### 5b.7 What future merchants should take from this

- **Meta paid-social CAN convert vertical-SaaS leads at $30 CAC on a $79 product.** The channel works. Don't skip it.
- **Replicate the v1_audit60s creative pattern**: phone-shot UGC video showing the audit running on a real customer's URL. Studio creative loses to authenticity here.
- **Use a free-tier hook that delivers visible value before payment** — free audit, free preview, free analysis. Customers convert in minutes when they've already seen a sample of the deliverable.
- **The platform now defends against silent failures** — fork the template and inherit the watchdogs, ops alerts, provider error detection, and pipeline pause flags. You'll know within 5 minutes if something breaks; the customer will know within seconds via the confirmation email.
- **Run the recovery flow on every refund.** Personal apology + discount + ask-what-they-want-fixed converts refunds into satisfied customers more often than you'd expect. Always trace the root cause first; the refund usually exposes a real bug worth fixing.
- **Watch the daily admin readiness panel** for stuck-paid-order count. If it's >0 for more than 5 min, stop everything and triage.

### 5b.8 Reference commits (in airbnb fork — `Zilla-HQ/airbnb`)

| Commit | What |
|---|---|
| `9bffc59` | fix(scraper): filter Airbnb AI-synthesis review stubs from photo list |
| `065bbf8` | fix(checkout): wire promo codes + immediate confirmation + stuck-order watchdog |
| `aac894d` | fix(reliability): silent-failure detection layer + auto-pause + ops alerts |
| `2ebde63` | tools(recovery): send-followup-with-sample.ts |

The reliability-layer patterns (`lib/provider-errors.ts`, `lib/order-confirmation.ts`, `lib/operator-alerts.ts` extension, `inngest/functions/order-stuck-watchdog.ts`, `inngest/functions/preview-stuck-watchdog.ts`, middleware promo-cookie capture) are now in this template (merchant-template commit `f34749a` — search "feat(reliability): backport silent-failure detection"). New merchants inherit them by default.

### 5b.9 Watch the actual ad

For future merchants studying this case study, the literal ad William saw is publicly viewable here:

> 👉 **https://www.facebook.com/61589080980649/posts/122099047281302699/**

22-second vertical Reel of a phone-shot screen recording — pasting an Airbnb URL into restay.agency, the audit running, ending on a free restyled-photo + pricing comp scan. **No studio production. No actor. No voiceover.** It's literally a screen recording with the v1_audit60s primary text in the post caption.

Replicate this pattern for your vertical: phone-shot screen recording of YOUR product running on a real customer's input. UGC reads as authentic; studio reads as advertising. Open the URL above before recording your own — calibrating to "this level of polish" rather than "studio production" is the single highest-leverage creative direction in the case study.

---

## 6. Auto-scaler — the budget algorithm

The template ships `inngest/functions/meta-ads-lead-scaler.ts` — runs daily at 1:30am UTC. **Stateless math: each run derives target budget from days-since-launch.**

### 6.1 The schedule (defaults)

```
Day  0:    $75/day  (launch budget)
Day  3:    $90/day  (+20%)
Day  6:   $108/day  (+20%)
Day  9:   $130/day
Day 12:   $156/day
Day 15:   $187/day
Day 18:   $200/day  (capped)
... stays at $200 thereafter
```

Math: `target = INITIAL × 1.2 ^ floor(days / 3)`, capped at `MAX`.

### 6.2 Pause-on-CAC-breach

The scaler also reads last-7d insights and pauses if CAC > ceiling **after $50+ of spend**:

```
Day  0-13:  ceiling = $7   (loose, let Meta learn)
Day 14+:    ceiling = $5   (steady-state economics)
```

Don't tighten ceilings before you have enough data — premature pause = the algo never gets out of learning phase.

### 6.3 Configure

```bash
# All optional — these are the defaults
META_LEAD_CAMPAIGN_ID=120243153024630527           # set after launch
META_LEAD_LAUNCH_DATE=2026-05-05                   # campaign launch date
META_LEAD_INITIAL_BUDGET_CENTS=7500                # $75/day starting
META_LEAD_MAX_BUDGET_CENTS=20000                   # $200/day hard cap
META_LEAD_CAC_CEILING_EARLY=7                      # first 14 days
META_LEAD_CAC_CEILING_STEADY=5                     # day 15+
META_LEAD_MIN_SPEND=50                             # min spend before pause is allowed
META_LEAD_FATIGUE_FREQUENCY=2.5                    # creative fatigue alert threshold
CRON_LEAD_SCALER_ENABLED=true                      # kill switch
```

### 6.4 Why stateless

We considered storing `last_bump_at` in the DB. Rejected because:
- Manual budget edits in Ads Manager would create drift (DB says X, Meta says Y, scaler doesn't know which to trust)
- Stateless = single source of truth (the launch date)
- If you edit budget manually, the scaler will revert it next run. **This is intentional** — your operator-knob is the launch date / config env vars, not direct budget edits

### 6.5 Smoke-test the scaler before deploying changes

`scripts/meta-test-lead-scaler.ts` — read-only. Prints what the scaler **would** do today without actually updating the campaign:

```bash
npx tsx scripts/meta-test-lead-scaler.ts
```

Run this whenever you change the config or are debugging.

---

## 7. Creative fatigue check

`inngest/functions/meta-ads-fatigue-check.ts` — runs daily at 9am UTC. Iterates active ads in the campaign, flags any with last-7d frequency > 2.5.

Fatigued ads = paying to re-show the same fatigued audiences = burning money. When flagged, refresh creative (new video, new copy, both).

---

## 8. Common errors and their fixes

| Error | What's actually wrong | Fix |
|---|---|---|
| `Permissions error (1815066)` on campaign create | Token lacks `ads_management` scope | Regenerate System User token with `ads_management` |
| `Invalid parameter (1815433)` on adset create + "Conversion event unavailable" | Optimizing on `LEAD` with `OUTCOME_SALES` (objective mismatch) | Change campaign objective to `OUTCOME_LEADS` (delete + recreate; can't change objective on existing) |
| `Invalid parameter (1870227)` "Advantage Audience Flag Required" | Meta v19 requires explicit `targeting_automation.advantage_audience: 0\|1` when interests are set | Add `targeting_automation: { advantage_audience: 0 }` to ad set targeting |
| Ad creative create: `Please specify one of image_hash or image_url` | Video creative needs an explicit thumbnail | Fetch `/<video_id>/thumbnails`, use the `is_preferred: true` URL as `image_url` in `video_data` |
| `Ads creative post was created by an app that is in development mode` | Your Meta app is still in Development mode | Flip app to Live mode (Settings → fill privacy URL + icon → toggle Live) |
| Video upload hangs forever in `"video_status":"uploading"` | `/act_<id>/advideos` known limitation with System User tokens | Upload via `/<page_id>/videos` chunked protocol (`scripts/meta-upload-page-video.ts`) |
| `(#210) A page access token is required` | Token lacks page scopes | Regenerate token with `pages_manage_posts` + `pages_read_engagement` |
| Ads stuck in `WITH_ISSUES` "Account does not have access to pixel" — even after fixing permissions | The error is cached at ad creation time. Meta says "create from scratch" | Delete the ads (campaign + adsets are fine), recreate the ads with `scripts/meta-create-ads.ts` |
| "Unassociated pixel" warning in Ads Manager | Pixel connected to ad account but only at "Track" level, not "Manage Pixel" | Business Settings → Datasets and pixels → your pixel → Connected assets → click your ad account → enable Manage Pixel |
| `Object does not exist... pages_read_engagement permission` when fetching page access_token | System User isn't assigned to the Page | Business Settings → Users → System Users → your user → Add Assets → Pages → toggle |

---

## 9. Operating playbook (week-by-week)

### Week 1
- **Day 0**: launch (paused), unpause once `PENDING_REVIEW` clears
- **Day 1-3**: don't panic. CTR/CPC stabilize. Probably no Lead events yet.
- **Day 4-6**: first Leads arrive. Auto-scaler starts bumping budget.
- **Day 7**: checkpoint — review CAC. Kill the worst ad if rankings are BELOW_AVERAGE.

### Week 2
- **Day 8-13**: budget continues climbing if CAC holds. Add 2-3 fresh creatives based on what the data tells you (which copy variant is winning).
- **Day 14**: CAC ceiling tightens to $5. Real economics test.

### Week 3+
- **Day 15+**: scale-or-kill. If CAC < $5 with healthy volume, you're winning — let it ride. If CAC is hovering around ceiling, refresh creative. If CAC > $5 with no obvious fix, kill and try a new angle.
- **Refresh creative every ~2 weeks** on winners. Frequency > 2.5 = burn money.

### Kill criteria (write these down — hold yourself to them)

- Ad: ranking = BELOW_AVERAGE on quality OR engagement → kill
- Ad set: CTR < 50% of campaign avg after $50 spent → kill
- Ad set: CAC > target × 1.5 after 30+ events → kill
- Ad: frequency > 3 with no fresh creative → refresh or kill

---

## 10. Token security

- **Never commit tokens to git.** Use `.env.local` (gitignored).
- **Never paste tokens in chat / docs / Slack.** They're bearer tokens.
- If a token is exposed, immediately rotate it: Business Settings → System Users → your user → **Generate New Token** → update everywhere it's used. The old token dies the moment a new one is generated.
- System User tokens **never expire** — that's the point. But a leaked one stays leaked until rotated.

---

## 11. Going beyond this template

When you outgrow this:
- **Multiple campaigns** — duplicate the launch script, use distinct `META_LEAD_*` env namespaces per campaign, or refactor the scaler to take campaign IDs as input
- **OUTCOME_SALES upgrade** — once you have ≥50 Purchases/week, spin up a parallel OUTCOME_SALES campaign with the same creatives. Compare CAC at the Purchase level.
- **Lookalike audiences** — once you have ≥100 Lead events in the pixel, build a 1% lookalike from the Lead-fired pixel users. Add as Ad Set C.
- **Retargeting** — use website-custom-audiences (visitors who fired ViewContent but not Lead) for a parallel campaign with lower-funnel creative.
- **Geo expansion** — start US-only, expand to UK/CA/AU once unit economics prove out. Don't go broader than English-language until you localize creative.

---

## TL;DR for the impatient

1. Set up: System User with all 5 scopes, assigned to ad account + page + pixel, all at Manage level. App in Live mode.
2. Launch programmatically: `scripts/meta-launch-campaign.ts` → `scripts/meta-upload-page-video.ts <video>` → `scripts/meta-create-ads.ts`.
3. Spot-check, unpause campaign → ad sets → ads.
4. Inngest crons handle the rest: budget scaling, CAC pause, fatigue alerts.
5. Refresh creative every 2 weeks. Kill on the criteria above. Don't panic before day 7.
