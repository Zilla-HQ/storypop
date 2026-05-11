# Google Ads — operator's guide

**For:** the person running a Zilla HQ sub-company day-to-day. Not the engineer who set up the API plumbing.

This guide assumes:
- Zilla HQ already did the one-time setup (Manager Account, API access, OAuth, refresh token). You don't redo any of it.
- An engineer has set the per-merchant env vars on your Vercel project.
- You're now responsible for: launching the branded-defense campaign in the Google Ads UI, monitoring it, and escalating issues.

If any of those aren't true, ping engineering first.

---

## ⚠️ Current status: Basic API Access pending

> **Last updated 2026-05-06.** The Zilla HQ Google Ads API token was submitted for Basic Access on 2026-05-06. Approval typically takes ~1 business day. Until it lands, the **automated launch script** isn't usable. **You'll launch your campaign manually through the Google Ads UI** (this doc walks through that — ~30 minutes).
>
> **What unlocks once Basic Access is approved:**
> - Future merchants get launched via a single CLI command instead of clicking through the UI
> - Daily budget management runs automatically via Inngest cron
> - Hourly campaign metrics sync to the admin dashboard
>
> **What's already working today (no API access needed):**
> - Branded campaign you launch manually via the UI runs normally
> - Conversion tracking is wired (gtag is on the site if `NEXT_PUBLIC_GOOGLE_ADS_ID` env var is set)
> - You can monitor spend, clicks, conversions in the Ads UI
>
> **You should:** check the email at `jack@seifdn.org` for the Google Ads API approval notice. When it lands, ping engineering — they'll re-run the smoke test on your merchant.

---

## What you need from engineering before starting

Get these from whoever set up the merchant in Vercel:

| Thing | What it is | Used in |
|---|---|---|
| **Google Ads ad account access** | An invite to your merchant's ad account | The Ads UI itself |
| **Customer ID** | 10-digit number identifying your merchant's ad account | Most pages that ask "what account are you using?" |
| **Manager Account name** | Should be `Zilla HQ` | When switching accounts in the top-right picker |
| **Confirmation that env vars are set** | `NEXT_PUBLIC_GOOGLE_ADS_ID`, `GOOGLE_ADS_CUSTOMER_ID`, etc. are in Vercel | So conversion tracking works on your site |

If you don't have these, stop and ping engineering.

---

## Why branded defense matters

For every Zilla HQ merchant, the **first paid campaign** is branded defense. Here's why:

> When someone Googles your brand name (`restay`, `realscale`, etc.), they already know who you are. They want to find you. Without branded ads, your organic search result still shows up — but if a competitor bids on your brand name, *their* ad shows above your organic result. The competitor essentially steals your most valuable click.

Branded ads cost $0.20–$0.75 per click on a brand new merchant (no competitors bidding yet) and lift conversion ~10% by re-affirming the brand at the moment of decision. At ~$50/month total spend, this is the highest ROI marketing you'll ever buy.

You launch this campaign once and then check on it monthly. That's it.

---

## Launching the campaign manually (~30 minutes)

This whole walkthrough is what the engineer's script will eventually do automatically. Until Basic API Access is approved, you do it by clicking through the UI.

### Step 1 — Sign in to Google Ads

1. Go to **https://ads.google.com**
2. Sign in with the email engineering invited you with
3. **Top-right account picker** → pick your merchant's ad account (NOT "Zilla HQ" — that's the parent Manager Account)

### Step 2 — Create the campaign

Click **"+ New campaign"** at the top of the dashboard.

#### 2a. Campaign goal
- **Goal:** Sales OR "Create a campaign without a goal's guidance" (either works for branded)
- **Campaign type:** **Search** ← critical. **Don't pick Performance Max** — Google pushes it but it burns budget on Display/YouTube junk for small budgets.
- **URL:** `https://<merchant-domain>` (e.g. `https://restay.agency`)

If Google tries to auto-upgrade you to Performance Max mid-flow, click "view other campaign types" and select Search.

#### 2b. Conversion goal
Pick **`Purchase`** as the only conversion goal. Skip every other option (Submit lead form, Phone calls, Page view, etc.).

When asked "How do you want to measure Purchase conversions?":
- Top option: **"Enter the URL that someone reaches after completing a purchase"**
- Type: `restay.agency/delivery/` (replace `restay.agency` with your merchant's domain — keep the trailing `/delivery/`)

**Skip** the "Set up manually using code" option for now. The URL-based approach is enough for $50/mo budget. Engineering can upgrade to value-tracking later.

#### 2c. Bidding
- **What do you want to focus on?** → switch dropdown from `Conversions` to **`Clicks`**
- **Set a maximum cost per click bid limit:** check this box → enter **`$1.50`**

If Google pushes "Maximize clicks" auto-bidding, find the small link **"Or, select a bid strategy directly (not recommended)"** at the bottom → choose **Manual CPC**.

#### 2d. Locations & languages
- **Locations:** type `United States` → select country-level. **Wipe** any auto-detected city/county Google fills in (it auto-detects from your IP).
- **Languages:** English

#### 2e. Audiences
**Skip / leave blank.** Branded keywords already target the right people.

#### 2f. Networks ("More settings" → expand)
- **Uncheck Search partners**
- **Uncheck Display Network**

Both should be OFF. You only want Google Search itself.

### Step 3 — Keywords

Single ad group. Paste these (one per line, brackets force exact match):

```
[<brand>]
[<brand> <product noun>]
[<brand> <merchant slug>]
"<brand>.<tld>"
```

For Restay, that was:
```
[restay]
[restay agency]
[restay airbnb]
[restay listing]
[restay tune up]
"restay.agency"
```

**Don't click "Get keyword suggestions"** — Google will try to broaden you to category terms that eat budget.

Negative keywords (block these — paste in the negative keyword list):

```
free
job
app
download
reviews
```

### Step 4 — Responsive Search Ad

You'll be asked for headlines (15 max, 30 chars each) and descriptions (4, 90 chars each). The pattern:

**15 headlines** — pin "Official Site" to position 1 (click pin icon next to that headline → "Pin to position 1"):

```
<Brand> - <Product>
Free <Vertical> Audit
Free Listing Grader
Rewrite, Restyle, Reprice
Less Than a Month of <Competitor>
$<Price> <Product>
Edit-Only Photos. TOS Safe.
4-Hour Listing Optimization
<Brand> Official Site
Stop Losing Bookings
Grade Your Listing Free
10-Second Listing Audit
No Subscription. One Time.
Get The 3 Highest-Impact Fixes
Refund Within 14 Days
```

(Adapt to your merchant's product — these are Restay's. Ask engineering for the merchant's specific copy.)

**4 descriptions** — keep each under 90 chars:

```
Paste your URL. Get an instant audit, restyled photo, pricing scan. Free.
One-time $<price>: <deliverables>. No sub.
<Compliance line>. Originals retained. <refund line>.
Less than a month of <competitor>. Delivered in <SLA>. <market>.
```

**Display path** (the visible URL slug):
- Path 1: `grade` (or `audit` — short product noun)
- Path 2: `free`

Visible URL becomes `<merchant>.<tld>/grade/free`. Lifts CTR ~5%.

### Step 5 — Sitelinks (4)

Click "+ Sitelink" four times. Each sitelink has a title (max 25 chars), 2 description lines (max 35 each), and a URL. Pattern:

| Sitelink text | Description 1 | Description 2 | URL |
|---|---|---|---|
| Free Listing Grader | Score your <noun> 0-100 | 10 seconds, no signup | `<domain>/grade` |
| $<Price> <Product> | <key deliverable> | <SLA> | `<domain>/<funnel>` |
| Partner Program | 30% commission, paid weekly | <merchant> affiliate program | `<domain>/partners` |
| Blog | Specific advice for <audience> | <N> articles, no fluff | `<domain>/blog` |

Lifts CTR ~10–15%, free to add.

### Step 6 — Callouts (8)

Quick bullets shown under the description. Add all 8; Google rotates and shows the 4 best-performing:

```
$<Price> one-time fee
Delivered in <SLA>
No subscription
14-day refund
Edit-only photos
<Compliance / TOS> compliant
<USP differentiator>
Originals retained
```

Each under 25 chars.

### Step 7 — Skip everything else

| Asset | Action |
|---|---|
| Promotions | skip — no promo deals |
| Prices | skip — confuses with multi-tier pricing |
| Calls | skip — no phone support |
| Structured snippets | skip — for header lists |
| Lead forms | skip — your site already has the URL paste form |
| Apps | skip — no mobile app |
| Image / Logo | skip — Search-only, doesn't render images |

### Step 8 — Final URL suffix

Find the **"Campaign URL options"** section. Paste in **Final URL suffix**:

```
utm_source=google&utm_medium=cpc&utm_campaign=branded_v1
```

(no `?` at the front — Google adds it automatically)

This auto-tags every click in the campaign — main URL, sitelinks, all of it — with UTMs. The merchant template's `lib/attribution.ts` middleware reads UTM params on first touch and persists them onto orders, so attribution flows through cleanly.

**Tracking template:** leave blank.
**Custom parameters:** leave blank.

### Step 9 — Budget

Click **"Set custom budget"** (don't use Google's recommended — it's wildly optimistic for branded).

```
$2.00 per day
```

That's $60/month. Branded campaigns rarely spend more than $20/month in real traffic — the cap is just a safety. You won't hit it for a new merchant.

### Step 10 — Review and submit

- Spot-check the ad preview pane: ad shows your brand name, sitelinks render, display path is right, final URL has UTMs
- Submit
- Campaign sits in **`UNDER REVIEW`** for 30–60 minutes, then starts serving
- Branded campaigns almost always approve without issue (you're bidding on your own brand)

---

## Daily / weekly cadence

### Daily (5 min, weekdays — only first 2 weeks)
- Open Google Ads dashboard, glance at:
  - Impressions (should be growing as people find your brand)
  - Clicks (should be cheap — under $1 typically)
  - Conversions (any number > 0 is great for branded; people who searched your brand are warm)
- Open `https://<merchant>/admin` to see the funnel

### Weekly (10 min, Sundays)
- Are you spending close to your $2/day cap? If yes → engineering will scale up automatically once Basic Access is approved (the Inngest scaler bumps budget +50% when consistently capping)
- Any RED status icons next to your ads? Click them to see why (usually a policy mismatch — easy to fix)

### Monthly (15 min)
- Verify total spend is reasonable ($20–60/month for branded — anything wildly over means a competitor started bidding on your brand; ping engineering)
- Click through to a few of your ads from a non-logged-in browser to verify the experience is normal
- Check `https://<merchant>/admin` for paid orders attributed to `utm_source=google`

---

## What to ping engineering about

| Situation | Why | Action |
|---|---|---|
| Email arrives saying "Google Ads API: Basic Access approved" | This unlocks automation | Forward to engineering, they'll re-run smoke test + flip on the Inngest cron |
| Ad stuck in `UNDER REVIEW` for >24 hours | Account-level review (rare for new accounts) | Engineering will need to verify domain ownership, contact Google support |
| `RED` status on the campaign or ad with "Disapproved" | Policy issue | Forward the rejection text — engineering rewrites the ad copy and resubmits |
| Spend is ~3× normal (e.g., $200 in a month for branded) | Competitor started bidding on your brand | Engineering raises max CPC slightly + runs SearchTerms report to identify which competitor |
| Conversions stop firing entirely | gtag broke | Engineering checks `NEXT_PUBLIC_GOOGLE_ADS_ID` env var + `app/api/stripe/webhook` |
| Search Terms report shows lots of irrelevant queries | Need negative keywords | Engineering adds negatives via API once Basic Access lands |
| You want to start a non-branded campaign | Bigger budget, more risk | Don't DIY — engineering reviews the unit economics first |

---

## What you should NOT do without engineering

- ❌ Switch bidding strategy from Manual CPC to anything auto (Maximize clicks, Target CPA, etc.) — at $50/mo budget, auto-bidding overspends
- ❌ Enable Performance Max — burns budget on Display/YouTube junk
- ❌ Add broad-match keywords — eats budget on irrelevant queries
- ❌ Disable the Final URL suffix — kills UTM attribution
- ❌ Pause the conversion action — kills attribution feedback to Google's algorithm
- ❌ Change the conversion URL pattern — depends on `/delivery/` matching the Stripe success URL

When in doubt: **don't click**. Ping engineering first. Most "small" changes in Google Ads have outsized downstream effects.

---

## Glossary (Google Ads jargon decoded)

| Term | What it actually means |
|---|---|
| **MCC** | "My Client Center" — the parent account that manages multiple ad accounts. For Zilla HQ this is `Zilla HQ`. You don't operate from here; you operate from your merchant's individual ad account. |
| **Customer ID** | Your ad account's unique 10-digit number. Different from the MCC's ID. |
| **Conversion ID (`AW-...`)** | Used by gtag.js to track conversions. Different from Customer ID — confusingly, the same advertiser has both. |
| **RSA** | Responsive Search Ad — the ad format you create with 15 headlines + 4 descriptions. Google rotates combinations and learns winners. |
| **Sitelinks / Callouts** | Free CTR-lifters under your main ad. Sitelinks are clickable links to specific pages; callouts are non-clickable bullet text. |
| **Ad Strength** | A 1-5 rating Google shows on your ad. **Ignore it for branded campaigns** — it penalizes you for pinning the brand name to position 1, but pinning is the right call. |
| **Manual CPC** | You set the max cost per click; Google bids up to that ceiling. Use this. |
| **Smart Bidding** | Auto-bidding that needs ~30 conversions/month to learn. Don't use until category Search has volume. |
| **Performance Max (PMax)** | Multi-channel auto-everything campaign. Don't use under $5k/mo budget. |
| **Search Terms report** | Shows the actual queries that triggered your ads (different from your keywords). Useful for finding negative-keyword candidates. |
| **Quality Score** | 1-10 rating per keyword. Higher = lower CPCs. Branded keywords usually score 9-10 because the landing page matches the search exactly. |
| **gclid** | Google Click ID — appended to ad URLs automatically. Used for conversion attribution back to specific clicks. |
