# Realscale — Growth Playbook

Living doc. Everything I built in this session is referenced below. The
**Manual TODO** section is the only place you have to spend time — every
other section is reference material your future self / agents pull from.

---

## What's now live in the codebase

### Programmatic SEO (≈ 350 indexed URLs from one component)
- `lib/cities.ts` — 75 US metros with median-home-price + pool/solar feasibility flags
- `components/marketing/city-page.tsx` — shared template (one file → all 5 service-city combos)
- `app/(marketing)/virtual-staging/[city]/page.tsx`
- `app/(marketing)/twilight-photos/[city]/page.tsx`
- `app/(marketing)/pool-cost/[city]/page.tsx` (climate-filtered)
- `app/(marketing)/solar-payback/[city]/page.tsx` (climate-filtered)
- `app/(marketing)/curb-appeal/[city]/page.tsx`
- `app/sitemap.ts` + `app/robots.ts`

### Free viral tool
- `app/(marketing)/tools/photo-score/page.tsx` — uses existing self-serve pipeline; no new backend

### Affiliate / referral program
- `lib/referral.ts` — deterministic email-hash codes, $25/listing payout
- `app/(marketing)/refer/page.tsx` + `refer-form.tsx` — partner signup
- `app/api/refer/generate/route.ts` — POST email → returns code + link
- `db/schema.ts` — added `referralCode` column to `orders`
- `middleware.ts` — captures `?ref=CODE` into a 30-day cookie
- `app/api/checkout/route.ts` — reads cookie, stamps it on order + Stripe metadata
- `app/admin/referrals/page.tsx` — leaderboard + payouts due

### Social auto-poster
- `lib/social.ts` — sharp-based 9:16 social card builder + Pinterest/TikTok clients
- `inngest/functions/social-poster.ts` — daily cron (9am ET) picks a fresh homeowner mockup, posts to Pinterest, stubs TikTok

---

## Manual TODO (in priority order)

Each item has the env var(s) or external action you need. Everything else runs once these are set.

### TIER 1 — DO THIS WEEK (gates everything below)

**1. ~~Run the DB migration~~** — already applied to your production DB. The `referral_code` column + `orders_referral_code_idx` index are live in `relist.orders`. Migration `0001_quiet_sleepwalker.sql` is committed and tracked in `drizzle.__drizzle_migrations`.

**2. Submit the new sitemap to Google Search Console.**
- Visit `https://search.google.com/search-console`
- Add property `https://realscale.app` if not already there
- Sitemaps → submit `https://realscale.app/sitemap.xml`
- Repeat for Bing Webmaster Tools (`https://www.bing.com/webmasters`)

**3. Verify all the new pages render in production.** After deploy:
- `https://realscale.app/virtual-staging/phoenix-az`
- `https://realscale.app/pool-cost/miami-fl`
- `https://realscale.app/tools/photo-score`
- `https://realscale.app/refer`
- `https://realscale.app/sitemap.xml` (should list ~350 URLs)
- `https://realscale.app/admin/referrals` (after you sign in as admin)

### TIER 2 — PINTEREST + TIKTOK SETUP (~30 min total)

**4. Pinterest API credentials.** This unblocks the daily auto-poster.
- Create a Pinterest business account if you don't have one
- Visit `https://developers.pinterest.com/apps/`
- Create an app → grab the access token (long-lived, scopes: `pins:write`, `boards:read`)
- Create a board called "Home Mockups" (or similar)
- Get the board id from `https://api.pinterest.com/v5/boards` (or from the board URL)
- Add to Vercel env:
  - `PINTEREST_ACCESS_TOKEN=...`
  - `PINTEREST_BOARD_ID=...`
- After deploy, manually trigger: in `/admin`, send the `social-poster/manual` event (or wait for next 9am ET cron)

**5. TikTok — defer until video gen is wired.** Image-only posts to TikTok aren't supported; we'd need a 5s ken-burns mp4 from the social card. The poster code is stubbed at the bottom of `inngest/functions/social-poster.ts`. When ready:
- Apply for TikTok for Developers app review (`https://developers.tiktok.com/apps/`)
- Request scopes: `video.publish` and `video.upload`
- Add `TIKTOK_ACCESS_TOKEN` env var
- Uncomment the TikTok block in `social-poster.ts`
- Add an ffmpeg step in `lib/social.ts` to produce mp4 from the card

### TIER 3 — PAID ADS LAUNCH (do as you have ad-account access)

**6. Relaunch the paused $75/day Meta Leads campaign** with the splits below. Creative copy + ad copy in the Meta Ads section below.

**7. Stand up Google Search Ads campaigns.** Keywords + ad copy in the Google Ads section below. Use Smart Bidding (Maximize Conversions). Tag conversion = `Purchase` Meta CAPI event (already firing).

**8. Pinterest Ads.** Promote the same pins that the auto-poster is creating organically. Boost the top 1–2 organic pins each week (Pinterest will surface them in your dashboard). Budget $200/wk to start.

**9. Reddit Promoted Posts.** r/realtors and r/realestate. Cheapest way to test agent-side messaging. $50–100/wk.

### TIER 4 — EARNED MEDIA + COMMUNITY (manual, ongoing)

**10. Pitch Inman / RISMedia / HousingWire** — see the Earned Media section below for the angle and template pitch.

**11. Plan the Show HN + Product Hunt launches.** See checklist in Earned Media section.

**12. Post the photo-score tool in 5 agent FB groups + Reddit weekly.** Bonus: build a /admin/social-script page that drafts a fresh Reddit comment for you each Monday.

---

## Google Search Ads — Keyword Lists

### Campaign A: Agent-side, high intent

**Ad group: virtual staging core**
```
[virtual staging]
[virtual staging ai]
[ai virtual staging]
"virtual staging service"
"virtual staging software"
[virtual staging real estate]
[virtual home staging]
"virtual staging for real estate"
+virtual +staging +real +estate +photo
```

**Ad group: photo enhancement core**
```
[real estate photo enhancement]
[mls photo enhancement]
"real estate photo editing"
[zillow photo edit]
"listing photo enhancement"
+real +estate +photo +editing
```

**Ad group: twilight conversion**
```
[twilight photo conversion]
[twilight real estate photos]
[real estate twilight editing]
"twilight photo service"
+twilight +real +estate
```

**Ad group: competitor conquest**
```
[boxbrownie alternative]
[boxbrownie pricing]
[virtualstagingai alternative]
[apply design alternative]
[stuccco alternative]
"boxbrownie review"
"virtual staging ai vs"
```

**Ad group: city + service** (use Google's broad-match modifier — let it expand)
```
+virtual +staging +phoenix
+virtual +staging +austin
+virtual +staging +miami
+virtual +staging +los +angeles
+virtual +staging +dallas
+virtual +staging +houston
+virtual +staging +chicago
+twilight +photos +"real estate" +austin
+twilight +photos +"real estate" +nashville
```
(Add more cities from `lib/cities.ts` as you scale spend.)

**Negative keywords** (pretty important — stops irrelevant clicks):
```
-furniture -decor -interior -designer -decorator
-game -movie -book -tv -show -netflix
-job -jobs -career -salary -hire -hiring
-tutorial -free -download -cracked -pirated
-course -training -class -learn -learning
-app -application -student -students
-stage -stages -theater -theatre
```

### Campaign B: Homeowner-side, high intent

**Ad group: pool cost**
```
[pool cost]
[swimming pool cost]
[inground pool cost]
[pool installation cost]
"how much does a pool cost"
+pool +cost +[city] (rotate through pool-feasible cities)
[backyard pool ideas]
[pool design]
```

**Ad group: solar**
```
[solar panel cost]
[home solar cost]
[solar payback]
"is solar worth it"
[solar panels for home]
[residential solar]
```

**Ad group: curb appeal**
```
[curb appeal ideas]
[front yard landscaping]
[front yard makeover]
"curb appeal before and after"
[landscaping ideas]
```

**Negatives:**
```
-pool -table -tables -accessories -float -floats
-cleaning -repair -liner -liners -chemicals
-job -jobs -salary -wage -wages
-installer -installers -contractor -contractors (you DON'T want contractor searches — that's competing for Angi traffic)
-rental -rentals
-luxury -hotel -hotels
```

---

## Google Search Ads — Ad Copy

### Agent-side ads (RSA — Responsive Search Ads)

Use these as the headline + description pool (Google rotates).

**Headlines (15 max, mix of these):**
```
Virtual Staging in 2 Hours
NAR-Compliant Photo Staging
Stage 12 Photos for $89
Beat BoxBrownie on Speed
Free Preview, No Signup
Paste Your Zillow URL
AI Stages MLS Photos in 2hr
{City} Virtual Staging
Twilight Exteriors $49/photo
14-Day Refund Guarantee
Built for Solo Agents
$89 Per Listing, No Subscription
See Your Listing Staged Free
Same-Day Photo Enhancement
Under 2 Hour Turnaround
```

**Descriptions (4 max):**
```
Paste any Zillow URL. Free AI-staged before/after in seconds. Pay $89 per listing only when you order. NAR disclosure baked in.
Traditional virtual staging: $30/photo, 24-48 hours. Realscale: $89 for the entire listing, under 2 hours, NAR-compliant.
12-15 staged interior photos, optional twilight exteriors, 4 style presets. Delivered in <2 hours. 14-day refund.
Built by an agent who hated waiting. Paste a Zillow link, see a free staged preview, pay only when you're sold.
```

**Sitelinks:**
```
Pricing — $89/listing | /agents#pricing
Free Photo Score — Rate any Zillow listing 1-5 free | /tools/photo-score
Sample Gallery — See real before/afters | /agents#samples
Refer & Earn — $25 per referred listing | /refer
```

**Callouts:**
```
Under 2-hour delivery
NAR-compliant disclosure
14-day refund guarantee
No subscription
Free preview, no signup
```

### Homeowner-side ads (RSA)

**Headlines:**
```
See a Pool in Your Backyard
Free AI Pool Mockup
{City} Pool Cost Estimate
Solar on Your Roof — Free Mockup
25-Year Solar Savings Estimate
Curb Appeal Before & After
Free Mockup of Your Real Home
Type Your Address, See Pool
Real Satellite View, Not Stock
No Signup, No Email Gate
Vetted Local Builders
Free Mockup, Free Quote
$0 to You, Builder Pays Us
See It Before You Build It
```

**Descriptions:**
```
Type your address. We render a pool on a real satellite view of your backyard in 90 seconds. Free. No signup.
Free pool mockup + build cost estimate for your zip code. Vetted local installers if you want to build.
Solar panels on your actual roof, with 25-year savings calculation against {City} utility rates. Free.
The mockup is free. Contractor introductions are free. The builder pays our fee — your quote is unchanged.
```

**Sitelinks:**
```
Pool Mockup — Free, your real backyard | /renovate
Solar Mockup — Free, 25-yr savings | /renovate
Curb Appeal Refresh — Free mockup | /renovate
How It Works — 3-step process | /renovate#how-it-works
```

---

## Meta Ads — Audience + Creative

### Audiences to build (in Ads Manager → Audiences)

**Agent-side**
1. **LAL of paid customers (1%):** seed = your Stripe customers email list. Scale = US. Best for cold traffic.
2. **Interest stack — Realtors:** Interests = "Realtor.com", "Zillow", "RE/MAX", "Coldwell Banker", "Keller Williams", "Real estate", "Real estate agent". Geo: US. Age: 25-65. Demographic: "Real estate" job titles. (Meta will narrow as you spend.)
3. **Lookalike of self-serve URL submitters:** seed = the Custom Audience that fires on PostHog `self_serve_submitted`. Forward this from PostHog to Meta via the existing CAPI pipe.
4. **Retargeting:** site visitors past 30 days, exclude paying customers. Hot pool.

**Homeowner-side**
1. **Geo-targeted high-value zips:** Use the cities in `lib/cities.ts` filtered to `poolFeasible: true`. Layer interest = "swimming pools", "home improvement", "backyard", "landscaping". Age: 30-65. Income: top 50% (only available in US).
2. **LAL of `/renovate` form submitters** (PostHog `homeowner_address_submitted` event).
3. **Solar-specific:** interest = "solar power", "renewable energy", "Tesla". Geo: same as above + add CO/UT/MA where utility rates are high.
4. **Pinterest cross-promote:** Use Meta Audience Insights to find people who follow Magnolia, Joanna Gaines, HGTV, "Fixer to Fabulous". Strong overlap with curb-appeal intent.

### Ad creative — agent-side

**Variant A — speed flex (3-second loop video)**
- 0–1s: text overlay "Listing posted 9:14 AM"
- 1–2s: shot of empty/dated MLS photo
- 2–3s: same photo, staged. Text: "Delivered 10:53 AM"
- Caption: "Virtual staging that arrives the same day you list. From $89/listing. No subscription."

**Variant B — direct comparison (static carousel)**
- Card 1: "BoxBrownie: $32/photo × 12 = $384. 24-48hr."
- Card 2: "Realscale: $89/listing total. <2hr. NAR-compliant."
- Card 3: Side-by-side before/after from `/agents#samples`.
- Card 4: "Paste your Zillow URL — free preview." CTA: Get Started

**Variant C — testimonial-style (no testimonial, just numbers)**
- Static image, big text: "$11K — average lift on listings priced $200K-$1M with pro photos. Source: Redfin, 50k+ listings."
- Caption: "Most agents spend $0 on listing photos because they don't have time. Realscale gives you 12 staged photos in <2 hours for $89."

### Ad creative — homeowner-side

**Variant A — surprise reveal (5–10s video)**
- Open: satellite view of plain suburban backyard
- 2s in: pool fades into the same satellite tile
- 4s in: text "Free. Your address. 90 seconds."
- Caption: "Type your address. See a real pool on a real satellite view of your backyard. Free."

**Variant B — myth bust (static)**
- Big text: "A new pool typically adds $15K to your home value in {City}. Mockup it free, build it later."
- Smaller: "We render the pool on a real satellite view of YOUR backyard. Not stock photos. Not rendering fakes."
- CTA: See My Pool Mockup

**Variant C — solar payback (static + numbers)**
- Headline: "$31,000."
- Subhead: "Estimated 25-year solar savings on the average {City} home, after federal tax credit + utility offset."
- CTA: See My Solar Mockup

---

## Pinterest + TikTok content angles (organic, scaled by `social-poster.ts`)

The auto-poster picks one fresh homeowner mockup per day and posts to Pinterest. To make those pins perform:

**High-performing pin titles**
- "{City} backyard pool ideas — see yours"
- "What a pool actually looks like in your backyard"
- "Free pool mockup on satellite view (no signup)"
- "Solar payback in {City}: 25-year savings"
- "Curb appeal before & after — your real house"

**Pin description template** (already wired in `social-poster.ts`):
```
{Service caption} rendered on a real satellite view of a home in {City, State}.
See yours free at realscale.app — type your address, get a mockup in 90 seconds. No signup.

#poolinstallation #backyardgoals #poolinspiration ...
```

**TikTok angles** (when you wire video):
1. "I gave 100 ugly Zillow listings AI photos" — series, episode per city
2. "Asking AI to put a pool in random houses" — fast cuts of satellite + mockup
3. "Rate this listing's photos 1-5" — your /tools/photo-score endpoint, faceless voiceover

---

## Reddit posting strategy

Don't drop links cold — Reddit will shadowban you. Pattern:
1. Subscribe to r/realtors, r/realestate, r/HomeImprovement, r/landscaping, r/pools, r/solar
2. Comment helpfully on 3 posts before mentioning your tool
3. When someone asks "what's a good way to make my listing photos look better" → "I built a free tool that scores Zillow photo quality 1-5 and gives one free AI-staged preview, no signup: realscale.app/tools/photo-score". Phrasing matters — "I built" beats "check out".
4. Post your own self-promo to r/realtors once a week max. Title: "Free tool: paste a Zillow URL, get an AI-staged before/after preview." Keep the body short and link the tool.

Subreddits ranked by ROI:
- **r/realtors** (60K) — direct ICP, mods are reasonable
- **r/realestate** (450K) — broader, includes buyers/sellers
- **r/HomeImprovement** (2.5M) — homeowner side
- **r/landscaping** (300K) — curb appeal + pool
- **r/pools** (45K) — extremely high intent
- **r/solar** (180K) — high intent, technical audience

---

## Earned media — pitch templates

### Inman / RISMedia / HousingWire

**Subject:** "AI agent runs an entire real estate photography business solo — happy to share data"

**Body:**
> Hi [reporter] — I run Realscale, a real estate photo enhancement service that's fully agent-operated end-to-end. One human (me) wrote the system; six AI agents handle discovery, qualification, photo generation, cold outreach, fulfillment, and reply triage. We've delivered [N] listings with zero human-in-the-loop on individual orders.
>
> I'm happy to walk you through:
> - The agent architecture (what each one does, how they hand off)
> - Real outreach data: open rates, conversion rates, what works at scale
> - Agent-side metrics: cost per acquisition, fulfillment cost, margin
> - The merchant-template thesis: this is built to fork into more verticals
>
> No PR ask, just sharing if it's useful for a piece on AI in real estate ops. I'm based in [city], 30-min call any time this week.
>
> — Jack

### Show HN

**Title:** "Show HN: I built an autonomous real estate photo SaaS — six agents, one human, no humans-in-the-loop on orders"

**Body opens with the autonomous-merchant thesis, links to /agents and /renovate, includes one screenshot of the /admin metrics dashboard.**

### Product Hunt

Launch the **homeowner side** (`/renovate`) — that's the cleaner consumer story for PH. Tagline: "See your home with a pool, solar, or new curb appeal — free, on a real satellite view."

---

## Affiliate program rollout

After the DB migration runs:
1. Manually generate codes for 5 friends/peers via `/refer`
2. Email them the link, ask them to share once
3. Watch `/admin/referrals` for first attribution
4. Once you have 3 paid orders attributed, post `/refer` to r/realtors and 2 agent FB groups: "I'm paying $25 per referral on a 30-day cookie. Code generator at /refer."
5. Top affiliates → DM them, offer to raise their rate to $40 in exchange for a recurring shoutout

---

## What I deferred (and why)

- **TikTok direct posting** — needs app review + video gen pipeline. Stub is in place.
- **LinkedIn Ads** — too expensive for $89 ACV. Skip.
- **Influencer marketing** — doesn't fit solo operator. Skip.
- **NAR / state association partnership** — requires sales calls. Defer until you have 3 months of paid org traction.
- **Email-list newsletter sponsorships** (Inman Connect, RealEstateNewsHub) — explore once you have an attribution model and CAC numbers.

---

## Numbers to watch in `/admin`

After everything ships, open the dashboard once a week and track:
1. **Organic landing on programmatic pages** → PostHog event `$pageview` filtered to `/virtual-staging/*`, `/pool-cost/*`, etc. Goal: 100+ uniques/week within 60 days.
2. **`self_serve_submitted` from organic source** — the conversion-to-fold-of-funnel for SEO traffic.
3. **`/admin/referrals` top affiliate** — when one referrer crosses 5 paid orders, double down on whatever channel they're using.
4. **`social_pinterest_posted` ok rate** — should be 100%. If not, debug the env vars.

---

*Generated 2026-05-06.*
