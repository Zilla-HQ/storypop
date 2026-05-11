# Sitebeat — Paid acquisition playbook

Two channels: **Meta Ads** (Facebook + Instagram) and **Reddit Ads**. Both have low friction to start, both work for the SMB / local-business / indie SaaS founder ICP, and both can be live in under an hour.

---

## Before you spend a dollar — install conversion tracking

Without these, you're flying blind. Both channels need to know which clicks → audits → subscriptions so they can optimize.

### 1. Meta Pixel (5 min)

1. Open https://business.facebook.com/events_manager → **Connect Data Sources** → **Web** → **Meta Pixel** → name it `Sitebeat`.
2. Copy the Pixel ID (16 digits).
3. Set as Vercel env var:
   ```bash
   vercel env add NEXT_PUBLIC_META_PIXEL_ID production --scope zilla-hq
   # paste the pixel id
   ```
4. Add to `app/layout.tsx` (I can build this if you ask — wire `NEXT_PUBLIC_META_PIXEL_ID` into a `<Script>` tag).
5. Conversion events to fire from the app:
   - `Lead` on POST `/api/audit` success
   - `Subscribe` on Stripe `checkout.session.completed` webhook (already wired — just add a `fetch('https://graph.facebook.com/v17.0/{PIXEL_ID}/events?...')` Conversions API call in the webhook handler)

### 2. Reddit Pixel (5 min)

1. Open https://ads.reddit.com → **Conversions** → **Create Pixel** → name `Sitebeat`.
2. Copy the **Pixel ID** + **Conversion API access token**.
3. Set as Vercel env vars:
   ```bash
   vercel env add NEXT_PUBLIC_REDDIT_PIXEL_ID production --scope zilla-hq
   vercel env add REDDIT_CONVERSIONS_TOKEN production --scope zilla-hq
   ```
4. Same conversion events as Meta — `Lead` on audit, `Purchase` on subscribe.

> **Tell me when you have these** and I'll wire both pixels + Conversions API server-side. ~20 min of work. Without it, both networks will burn budget for 2 weeks before figuring out the conversion pattern; with it, optimization kicks in within 24h.

---

## Meta Ads (Facebook + Instagram)

### Account setup (15 min)

1. **Business Manager**: https://business.facebook.com → Create new Business → name `Sitebeat`.
2. **Ad Account**: Business Manager → Accounts → Ad Accounts → Add → Create New → currency USD, time zone Eastern.
3. **Payment**: Add a credit card. Set daily spend limit to **$50/day** initially (max safety while learning).
4. **Domain Verification**: Business Settings → Brand Safety → Domains → add `sitebeat.tech`. Verify via DNS TXT record.
5. **iOS 14+ events**: Aggregated Event Measurement → prioritize 8 events for `sitebeat.tech` — order matters: `Subscribe` > `Lead` > `ViewContent`.

### Campaign #1 — "Free SEO audit" lead-gen (start here)

| | |
|---|---|
| **Campaign objective** | Sales (with `Subscribe` as the conversion event once tracking is wired). Falls back to `Lead` (audit submitted) until we have 50+ subscribes. |
| **Campaign budget** | $25/day, lifetime budget $300 to start (12 days). |
| **Audience: Local SMB owners** | Detailed targeting: people whose job titles include "Owner", "Founder", "CEO" of small businesses (1–10 employees). Behavior: Small Business Owners. Interests: Search Engine Optimization, Google Search, Google My Business. Geography: USA only initially (cheaper CPM than UK/AU/CA). Age: 28–60. |
| **Audience: Restaurant owners** | Job titles: Restaurant Owner / Operator. Interest: Restaurant Management. Behavior: Small Business Owner — Food and Drink. |
| **Audience: Indie SaaS / dev** | Interest: SaaS, Indie Hackers, ProductHunt, GitHub. Job: Web Developer, Software Engineer, Founder. |
| **Placements** | Auto. Meta will weight Reels heavily (cheap clicks, good for ICPs that scroll). |
| **Ad format** | Single image OR 15-second vertical video. NOT carousels for cold audiences. |

### Ad creative angles (pick 3, A/B test)

1. **Pain**: "Your site is invisible to most search crawlers. Find out which ones in 30 seconds — free." → audit form
2. **Curiosity**: Screenshot of an example F-grade report. "SEO grade: F. Here's what's broken on most restaurant sites we audit. → Try yours free."
3. **Authority**: "We just audited 100 [restaurants/HVAC contractors/SaaS sites]. Here are the 5 SEO mistakes nearly all of them make." → audit form on click
4. **FOMO**: "Your competitors are getting weekly SEO alerts. You're getting silence. → Free audit."
5. **Curiosity hook video**: 5 seconds of a score gauge dropping from 90 to 50. Voiceover: "If your SEO score dropped overnight, would you even know?" → CTA "Get your score"

### Landing page

Send Meta traffic directly to `https://sitebeat.tech/` — the homepage now has the form, social proof, how-it-works, and FAQ. Don't build a separate Meta landing page for v1.

### Budget pacing

- **Week 1**: $25/day across 3 ad sets, 3 creatives each = 9 ads. Let Meta optimize. **Don't pause anything yet** — Meta's algorithm needs ~50 conversions per ad set to learn.
- **Week 2**: pause bottom-50% by CPL (cost per lead). Increase budget on top-50% by 20%/day max (faster increases trigger learning-phase reset).
- **Week 3+**: scale winners, build lookalike audiences from `Subscribe` event (1% LAL).

### KPIs

| Metric | Target | Action if worse |
|---|---|---|
| **CPL** (cost per audit submitted) | $2–5 | Pause / re-creative |
| **CPS** (cost per subscription) | < $50 (LTV is $290+) | Iterate angles |
| **CTR** | > 1.5% | Re-creative |
| **CPC** | < $1.50 | Re-targeting / interest stack |

---

## Reddit Ads

Reddit has 1/10th of Meta's reach but the audience self-segregates into perfect-fit subreddits. CPMs are higher than Meta but conversion rate is often 3-5× because intent is so high.

### Account setup (10 min)

1. https://ads.reddit.com → Sign up.
2. Verify business. Add credit card. Daily spend limit $25 to start.
3. Conversion tracking: see "Reddit Pixel" above.

### Campaign #1 — Subreddit-targeted audit lead-gen

**Objective**: Conversions (`Lead` event). Reddit will optimize against the audit form submit.

**Bid strategy**: Maximize Conversions. Daily budget $15.

**Subreddits to target** (Reddit's "Communities" targeting — you can add up to 200):

For local SMB:
- `r/smallbusiness` (1.4M)
- `r/Entrepreneur` (3.6M)
- `r/EntrepreneurRideAlong` (450K)
- `r/restaurateur` (15K — niche but high-intent)
- `r/restaurantowners` (12K)
- `r/HVAC` (135K — owners + employees)
- `r/Plumbing` (130K)
- `r/Construction` (350K)
- `r/Roofing` (50K)
- `r/Landscaping` (180K)

For indie SaaS / dev:
- `r/SaaS` (140K)
- `r/indiehackers` (40K)
- `r/SideProject` (200K)
- `r/webdev` (1.6M — broader, less converting)
- `r/Entrepreneur` (overlaps with above)
- `r/ProductManagement` (160K)
- `r/SEO` (150K — direct ICP, very high intent)

For the Reddit-native angle:
- `r/Marketing` (220K)
- `r/SEO_tools` (12K)
- `r/bigseo` (30K)

### Ad creative — Reddit-specific rules

- **Native style wins**. Make the ad look like a Reddit post. Avoid stock photos.
- **Format**: image post or text post. Skip video (low CTR on Reddit).
- **Headline as a question or specific claim**:
  - "Free tool: get your site's SEO graded in 30 seconds"
  - "I built a free SEO grader for small businesses. Tell me what your score is."
  - "Most restaurant websites score below 70/100 on basic SEO. What's yours?"
- **Image**: a clean screenshot of an example report (the new letter-grade hero is perfect for this).
- **CTA button**: "Try Now"
- **Disable comments at first**. Reddit ads can be brutal in comments. Once you have 5+ paying customers, re-enable for social proof.

### Promoted Posts (organic-feeling) — alternate angle

Stronger CPL than direct ads, but riskier:

1. Post organically in `r/smallbusiness` or `r/SaaS`: "I built a free tool that re-checks your SEO every Monday and only emails you when something breaks. Here's what it found on my own site → [screenshot]. Free if you want to try yours: sitebeat.tech"
2. Wait 3-7 days for organic traction (or fall flat).
3. Promote the post via Reddit Ads → Existing Post.

This route has higher upside but requires authentic karma + a non-shilly post. Don't do it from a brand-new account — get 100+ comment karma in target subs first.

### KPIs

Same as Meta but expect:

| Metric | Reddit target | Meta target |
|---|---|---|
| CPL | $5–10 (higher) | $2–5 |
| Conversion rate (audit → subscribe) | 8–15% (3× Meta) | 2–5% |
| Net CPS | similar to Meta | — |

Reddit's higher CPL is offset by higher subscribe conversion because the audience is already SEO-curious.

---

## Recommended day-1 split

| Channel | Daily budget | Why |
|---|---|---|
| Meta | $25 | Volume + learning. ICP-1 (restaurant/SMB owner), ICP-2 (indie SaaS), ICP-3 (HVAC/contractor) — three ad sets. |
| Reddit | $15 | High-intent. Target r/SaaS + r/smallbusiness + r/HVAC + r/SEO directly. |
| **Total** | **$40/day** | $1200/mo — conservative learning budget. Scale to $200/day once CPS holds under $50. |

After 2 weeks of data, kill whichever is worse.

---

## Meta + Reddit ad copy library (paste-ready)

**Headline candidates** (test 3-5):
- "What grade is your SEO?"
- "Find out what's wrong with your SEO in 30 seconds"
- "Your site might be invisible to Google. Here's how to check — free"
- "We grade your SEO from A+ to F. Subscribe to keep it from regressing."
- "13 SEO checks. 30 seconds. Free."

**Body candidates**:
- "Drop your URL. We crawl your site, run 13 checks, and email a graded report with exact fixes for everything broken. Subscribe and we re-check it every Monday — silence unless something breaks."
- "Most local businesses lose customers because their site is invisible to Google. Find out where you stand in 30 seconds, free, no signup."
- "If your SEO regressed yesterday, would you even know? Sitebeat does. Re-checks your site every Monday. Email when anything goes wrong. $29/mo, cancel anytime."

**CTAs**:
- Get my score → (best for cold)
- Free audit → (alt)
- Try it on my site → (informal)
- Subscribe →  (only for re-targeting/warm)

---

## Pre-flight checklist

- [ ] Meta Business Manager account created
- [ ] Meta Pixel installed on sitebeat.tech (I can wire it once you have the ID)
- [ ] Domain verified on Meta
- [ ] Reddit Ads account created
- [ ] Reddit Pixel installed (I can wire it)
- [ ] Conversions API server-side events firing (I can wire it)
- [ ] Stripe Customer Portal enabled (you confirmed this)
- [ ] Daily spend limits set: Meta $50/day, Reddit $25/day
- [ ] First 3 ad creatives written (use the library above)

When you're ready to launch, send me both pixel IDs + the Reddit Conversions token and I'll wire all the tracking server-side in one PR.
