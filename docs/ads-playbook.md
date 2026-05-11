# Ads Playbook — Zilla-HQ merchants

This is the canonical paid-acquisition guide for any merchant fork. It's optimized for:
- One-time-purchase SaaS at $50–200 ASP
- Cold audiences (no existing pixel data)
- Solo-operator launch with $50–500/month test budgets

Examples below use **Restay** (Airbnb listing optimizer, $79 ASP). Swap keywords, copy, and audience for other merchants.

---

## Quick TL;DR

| | Channel | Budget | Daily cap | Days | What it's testing |
|---|---|---|---|---|---|
| 1 | Google Search | $20 | $4/day | 5 | Pure intent — does the search term exist? |
| 2 | Meta (Instagram Reels) | $15 | $3/day | 5 | Visual hook reach — does the before/after stop scroll? |
| 3 | Reddit promoted | $15 | $3/day | 5 | Community fit — does the framing land in r/airbnb_hosts? |
| **Total** | | **$50** | | | |

After 5 days you have ≈ 60-150 clicks. Ratio of clicks → URL pastes → checkouts → paid will tell you which channel to scale 10×.

**Honest expectation:** $50 won't produce profit. It produces **signal**. At $79 ASP and ~0.1-0.5% click→paid baseline, you should expect 0–1 paid sales from the test — that's fine, you're buying data on which channel converts.

---

## Pre-launch (do once, applies to all 3 channels)

### 1. UTM strategy

Every ad URL ends with this template:

```
https://<merchant-domain>/?utm_source=<channel>&utm_medium=cpc&utm_campaign=<campaign-slug>&utm_content=<creative-id>
```

Examples for Restay:
- Google: `https://restay.agency/?utm_source=google&utm_medium=cpc&utm_campaign=audit_v1&utm_content=hl1_audit60s`
- Meta: `https://restay.agency/?utm_source=meta&utm_medium=cpc&utm_campaign=audit_v1&utm_content=reel_kitchen_before_after`
- Reddit: `https://restay.agency/?utm_source=reddit&utm_medium=cpc&utm_campaign=audit_v1&utm_content=r_hosts_post1`

The `lib/attribution.ts` middleware persists these into a 30-day cookie on first touch and writes them onto `listings.utm_*` when a host pastes a URL. `/admin/orders` joins back to listings — you can sort by UTM source to see which channel actually paid.

### 2. Conversion pixel slots

`app/layout.tsx` reads three env vars and injects each pixel only if set. Add to Vercel env:

| Env var | Where to get it |
|---|---|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads → Tools → Conversions → Create → "Tag ID" (`AW-XXXXXXXXXX`) |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Events Manager → Create Pixel → 16-digit ID |
| `NEXT_PUBLIC_REDDIT_PIXEL_ID` | Reddit Ads → Pixel → "Pixel ID" (`a2_xxxxxxxx`) |

Conversion events fire on:
- `home_visited` (every page view, free)
- `url_pasted` (when host submits in `/api/self-serve`)
- `checkout_started` (Stripe redirect)
- `purchase` (Stripe webhook `checkout.session.completed`)

### 3. Landing-page hygiene

Restay's homepage already has:
- Single clear CTA (URL paste form, hero placement)
- Before/after sample sliders (placehold.co images for now; real samples after R2 upload)
- $79 price stated above the fold
- FAQ to handle objections
- Testimonials section: `TODO — once we have real reviews from the first 10 customers`

**One landing page works for all 3 channels.** Landing-page A/B testing is overkill at $50 spend.

---

## Campaign 1: Google Search — $20

### Account setup (15 min)

1. https://ads.google.com → Sign in with Zilla-HQ Google account → "New campaign"
2. **Goal:** Website traffic
3. **Campaign type:** Search
4. **Choose ways to reach goal:** Website visits → enter `https://restay.agency`
5. Skip "Smart Bidding" upsell → choose **Manual CPC** later

### Campaign settings

| Setting | Value | Why |
|---|---|---|
| Networks | Search Network only — uncheck "Display Network" | Display = junk impressions, lower-intent. |
| Locations | United States | Restay v1 is US-only per `state-optout.ts`. |
| Languages | English | |
| Audience segments | Skip | Search keyword IS the targeting. |
| Budget | $4/day | $20 / 5 days |
| Bidding | Manual CPC, max CPC = $2.50 | Cap pain, prevents one click eating $5. |
| Ad rotation | Optimize for clicks | |

### Keywords (one ad group, exact + phrase mix)

```
[airbnb listing optimizer]
[airbnb listing audit]
"airbnb listing optimization"
"airbnb listing photos"
"improve airbnb bookings"
"airbnb listing review"
"how to optimize airbnb listing"
"airbnb listing not getting bookings"
```

Negative keywords (block these):
```
free
job
career
hire
template
example
script
github
api
```

### Responsive search ad (RSA)

Add **all 8 headlines** + **3 descriptions**. Google rotates and learns winners.

**Headlines** (max 30 chars each):
1. `Audit Your Airbnb in 60s`
2. `Free Listing Audit — No Signup`
3. `Restay — $79 Listing Tune-Up`
4. `Rewrite, Restyle, Reprice`
5. `Less Than a Month of Guesty`
6. `Stop Leaving Bookings on Table`
7. `Edit-Only Photos · Airbnb Safe`
8. `Your Listing, Optimized in 4hrs`

**Descriptions** (max 90 chars):
1. `Paste your URL. Get an instant audit, restyled photo, and pricing comp scan. Free.`
2. `One-time $79 — rewritten copy, 10 edited photos, 30-day pricing report. No subscription.`
3. `Edit-only photos (Airbnb-compliant). Originals retained. Refund within 14 days.`

**Final URL:** `https://restay.agency/?utm_source=google&utm_medium=cpc&utm_campaign=audit_v1&utm_content=rsa_v1`

### Conversion tracking in Google Ads

1. Google Ads → Tools → Conversions → New
2. **Source:** Website
3. **Conversion name:** `Restay — Purchase`
4. **Goal:** Purchase
5. **Value:** Use different values for each conversion → use the value passed by the tag (Stripe will pass real $79/$129/$149)
6. **Count:** One per click
7. **Click-through window:** 30 days
8. Get the `AW-XXXXXXXXXX` tag ID → set `NEXT_PUBLIC_GOOGLE_ADS_ID` in Vercel env

### Kill criteria

- After day 3: if CTR < 2% on top headlines → re-write copy
- After day 5: if 0 conversions and < 30 clicks → keyword/landing page mismatch, pause and re-test in 2 weeks

---

## Campaign 2: Meta — Instagram Reels — $15

### Account setup (10 min)

1. https://business.facebook.com → Ads Manager → Create campaign
2. **Buying type:** Auction
3. **Objective:** Sales (event = `Purchase`)
4. **Campaign budget optimization:** OFF (we'll set ad-set level budget manually)

### Ad set settings

| Setting | Value |
|---|---|
| Performance goal | Maximize value of conversions |
| Conversion event | Purchase (set after pixel verified) |
| Daily budget | $3 |
| Schedule | 5 days |
| Locations | United States |
| Age | 28-65 |
| Detailed targeting | Interest = "Airbnb" + "Vacation rentals" + "Property management" |
| Placements | **Manual** → Instagram Reels only (not Feed, not Stories) |

### Creative — single ad

**Format:** Reel video, 9:16, 15-30 seconds.

**Hook (first 1 second):** Phone screen recording of pasting an Airbnb URL into restay.agency.

**Body (5-15 seconds):** Speed-up screencast of the audit running. The before/after photo flips.

**End frame (last 2 seconds):** Text overlay: `Free 60-second Airbnb audit · restay.agency`

**Caption** (max 125 chars before "...more"):
```
Most listings haven't been updated in over a year. Free 60-second audit. Restay.agency
```

**CTA button:** "Learn More"

**Final URL:** `https://restay.agency/?utm_source=meta&utm_medium=cpc&utm_campaign=audit_v1&utm_content=reel_v1`

### Pixel setup

1. Meta Events Manager → Pixels → Create
2. Copy the 16-digit pixel ID → set `NEXT_PUBLIC_META_PIXEL_ID` in Vercel env
3. Verify Conversions API → grab CAPI access token → set `META_CAPI_TOKEN` (server-side fires events with full attribution even if browser blocks the pixel)

### Kill criteria

- Day 2: if cost-per-click > $1.50 → tighten audience or pause
- Day 5: if 0 URL pastes → creative isn't landing, swap reel

---

## Campaign 3: Reddit promoted post — $15

### Account setup (5 min)

1. https://ads.reddit.com → Sign up
2. Create campaign → **Objective:** Traffic
3. **Format:** Promoted post (link + image)

### Targeting

| Setting | Value |
|---|---|
| Locations | United States |
| Communities | `r/airbnb_hosts` (180k), `r/Superhost` (smaller, pure ICP), `r/AirBnB` (large but mixed) |
| Devices | All |
| Daily budget | $3 |
| Bidding | Cost cap, $0.80 / click |

### Creative

**Headline (300 chars max):**
```
What if you could see exactly what's holding your listing back? Free 60-second audit (paid tool, not a sales pitch)
```

**Body** (post-style, ~250 words — Reddit hates ad-speak):
```
Hey hosts —

Built a tool that scrapes your listing and shows you what comparable hosts are doing differently. Specifically:

• Rewrites your title (most are doing the same generic "X-bedroom in [city]" thing — the algorithm rewards specificity)
• Restyles ONE of your photos so you can see the difference (declutter, relight, color — no virtual furniture, Airbnb-policy compliant)
• Pulls 50+ nearby comps and shows where your nightly rate sits

The audit is free (no signup). The full optimization (10 photos + new copy + pricing report) is $79 one-time if you want everything done — less than a month of Guesty/Hospitable, and it's a one-shot, not a recurring sub.

The reason I built this: most hosts set up their listing once and never come back, but the market shifts every 90 days. Worth running once a quarter just to check.

Drop your URL: restay.agency

Edit: not a bot, happy to answer questions in comments. Built this for myself first.
```

**Image:** A clean before/after sample (use one of the placehold.co URLs from `lib/samples.ts` or the real fal.ai output we generated earlier).

**Destination:** `https://restay.agency/?utm_source=reddit&utm_medium=cpc&utm_campaign=audit_v1&utm_content=hosts_post1`

### Pixel setup

1. Reddit Ads → Conversion → Create pixel
2. Copy `a2_xxxxxxxx` → `NEXT_PUBLIC_REDDIT_PIXEL_ID` in Vercel env
3. Track event: `Purchase` with value

### Kill criteria

- Day 3: monitor comments — if downvoted heavily, the framing is off; rewrite body for more peer-to-peer tone
- Day 5: if 0 URL pastes → community fit is bad, try different subreddits

---

## Daily monitoring routine (10 min/day)

After ads launch, every morning:

1. **Each platform's dashboard** — note CPC, impressions, clicks
2. **`/admin/dashboard` on restay.agency** — funnel metrics: scraped → qualified → previews → emails sent → paid orders today
3. **Supabase query** — listings grouped by `utm_source`:

```sql
SELECT
  COALESCE(utm_source, 'organic') AS channel,
  COUNT(*) AS pastes,
  COUNT(*) FILTER (WHERE id IN (SELECT listing_id FROM restay.orders WHERE status = 'paid')) AS paid_orders
FROM restay.listings
WHERE created_at >= now() - interval '7 days'
GROUP BY channel
ORDER BY pastes DESC;
```

4. **Resend dashboard** — bounce rate < 2%, complaint rate < 0.1%. If anything trips, halt sends immediately.

---

## Decision tree after 5 days

```
Total paid orders ≥ 1?
├── YES → identify which channel converted
│         ├── Google → scale to $20/day, narrow keywords to high-converters
│         ├── Meta  → scale to $15/day, A/B 3 new reel hooks
│         └── Reddit → expand to 2-3 more subreddits at same budget
└── NO → analyze the funnel decay
          ├── Click → URL paste rate < 5%? → landing page weak. Rewrite hero copy + new test
          ├── Paste → preview rate < 70%? → broken pipeline (shouldn't happen, alert!)
          ├── Preview → checkout rate < 5%? → /l/<slug> page weak. Add testimonials, urgency
          └── Checkout → paid rate < 25%? → trust gap. Add reviews, money-back guarantee
```

---

## Beyond $50 — when to escalate

This playbook is the $50 sanity test. Real scale plays:

| Spend | Strategy |
|---|---|
| $500/mo | One winning channel from the test, scaled. Add lookalike audiences in Meta. |
| $2k/mo | Add YouTube TrueView + retargeting (Meta + Google) on bounced visitors. |
| $5k+/mo | Hire a media buyer. ROAS analysis daily. Multi-creative production weekly. |

At each step, you also need:
- **Email capture** before checkout (lead nurture for non-immediate buyers)
- **Subscription tier** (lift LTV from $79 to $200+ to make CAC math work)
- **A/B testing infrastructure** (currently we have URL params, no formal A/B framework)

---

## Per-merchant customization checklist

For Realscale (or any new merchant fork), edit only:

- [ ] Final URLs at the bottom of each ad (swap `restay.agency` → `<merchant>.app`)
- [ ] Keywords — replace with vertical's intent terms (Realscale: "real estate listing photos", "MLS photo enhancement")
- [ ] Subreddits — find vertical-specific communities (Realscale: `r/realtors`, `r/RealEstate`)
- [ ] Meta interest targeting — change "Airbnb" interest to relevant (Realscale: "Real estate", "Realtor", "Home staging")
- [ ] Headline + body copy — keep structure, swap value prop language
- [ ] Conversion event names if different (Restay: `purchase`; same for Realscale)
- [ ] Pixel IDs (one set per merchant; never share Pixels across)
