# Sitebeat launch posts — copy-paste ready

> Drafts as of 2026-05-07. Submit from Jack's accounts; the bot can't auth as a human on these surfaces.

---

## 1. Show HN — submit tonight (US evening / morning EU = good crossover)

**URL:** `https://news.ycombinator.com/submit`

**Title field** (HN strips most punctuation; leave it short and honest):

```
Show HN: Sitebeat – I built an SEO monitor that emails only when something regresses
```

**URL field:**

```
https://sitebeat.tech
```

**Text field** (optional — HN posters sometimes leave blank with a URL submission, but a thoughtful intro lifts engagement):

```
Most SEO tools are dashboards I'd never log into. The actual job-to-be-done is "tell me when my site quietly broke" — when a Webflow theme strips your schema, a WordPress plugin update breaks your canonical, a page-builder edit deletes your meta description. Your traffic drops weeks before you notice.

Sitebeat does one thing: drop a URL, get a graded report on 13 SEO checks (HTTPS, meta description, headings, canonical, sitemap, robots, viewport, alt text, OG, broken links, structured data, local-business schema, NAP). Free first audit. Then for $29/mo we re-run that same audit every Monday and email only when something regresses. No dashboard, no logging in.

Free 14-day trial on monthly. The first audit is always free even without a trial.

Built solo. Stack: Next.js 15 / Supabase / Inngest / Resend / Stripe / Cloudflare R2. Audits run in ~3s for the average page; the heaviest check is broken-link verification.

Three things I'd love feedback on:

1. The "alert only on regression" angle — is "weekly check + diff against last week" actually how you'd want to consume SEO monitoring, or is there a different cadence/trigger that'd feel more useful?
2. The 13-check set — anything obvious I'm missing for SMB sites? (Considering: Core Web Vitals via PSI, hreflang for multi-locale sites, IndexNow ping confirmation.)
3. What's your read on whether $29/mo is the right price point for "set it and forget it weekly SEO monitoring"?

Site: https://sitebeat.tech
Free audit: drop any URL on the homepage
```

**Tactics:**
- Submit between 8–10 PM Pacific (catches both US Pacific evening and AU/EU morning).
- First-hour activity matters. Refresh; comment on adjacent posts to stay on the page.
- Don't ask friends to upvote — HN flag-detects ring voting.
- Be present in the thread for 4–6 hours after posting. Reply to every comment. That's the signal HN ranks on.

**If it gains traction**, expect 500–3000 visits in 24h. Conversion expectation: 1–3% to paid trial = 5–90 trials, of which 30–50% convert at end of trial = 1–45 customers.

---

## 2. ProductHunt — schedule for **tomorrow** (Thursday) launch at 12:01 AM Pacific

**URL:** `https://www.producthunt.com/products/new`

PH submissions are scheduled, not instant. Submit the listing tonight, schedule it for 12:01 AM PT tomorrow morning. PH ranks by upvote velocity in the first 6 hours of a single calendar day, so you want a full 24-hour window.

**Tagline** (60 char limit):
```
Weekly SEO monitoring that emails only when something breaks
```

**Description:**
```
Sitebeat re-audits your site every Monday and emails you only when an SEO check regresses. 13 checks: HTTPS, meta description, headings, canonical, sitemap, robots, viewport, alt text, OG, broken links, structured data, local-business schema, NAP. No dashboard to log into.

Drop your URL — get a graded report (free). Subscribe — we watch it weekly. First 14 days free.

Built for the small businesses who hire a developer once, then watch their search traffic mysteriously decline 6 months later because a plugin update silently broke their schema.
```

**Maker comment** (post as a comment on your own launch within the first hour):
```
Hey PH — Jack here, founder of Sitebeat.

I built this because every "SEO tool" I tried was a dashboard I'd never log into. The actual moments where SEO bites you are silent: a theme update strips your structured data, a page-builder edit breaks your canonical, your CMS auto-generates a meta description that's too long. None of those things break a page visibly. Your traffic just drops a few weeks later.

Sitebeat is the simplest possible answer: re-run the audit every Monday, only email if something changed. No dashboard. The 13-check set covers the SMB-relevant stuff that breaks most often.

Free first audit, no signup. Free 14-day trial on monthly ($29/mo after).

Three things I'd love your feedback on in this thread:
- The "regression-only email" cadence — is that how you'd want this delivered, or do you want a weekly summary regardless?
- Anything missing from the 13 checks for the kind of sites you run?
- Is $29/mo the right price for "I never have to think about SEO regressions again"?

Will be here all day answering. AMA.
```

**Tactics:**
- Tag 3–5 makers as "hunters" in your launch (PH lets you credit collaborators).
- DM 10–20 PH friends in the 48 hours before — ask them to drop in on launch day, not for an upvote.
- Reply to every comment within 30 min during peak hours (6 AM–4 PM Pacific).
- Don't post in PH's Slack/Discord asking for votes — gets you flagged.

**Expected outcome:** Top 5 product of the day yields 200–800 visits, top 10 yields ~150–400. Trial conversion ~5–15% (PH audience is high-intent makers + indie hackers, our ICP).

---

## 3. r/SEO — submit any time today

**URL:** `https://www.reddit.com/r/SEO/submit`

r/SEO has a loose "Sundays only for self-promotion" rule, but tools/products with a free tier and no paywall are tolerated weekday-posted *if* you frame it as a tool share, not a sales pitch. Read the sidebar twice before posting; mods are aggressive. If banned, fall back to r/SaaS or r/SmallBusiness.

**Title:**

```
I built a free SEO audit + weekly regression-monitor for SMB sites — would love feedback on the 13 checks
```

**Body:**

```
Hi r/SEO. Solo dev, built this over the last 6 weeks. The tool is at sitebeat.tech.

The audit is free, no signup, no email gate (you can submit your email if you want the report mailed). It runs 13 checks:

  HTTPS · meta description · heading structure · page load (TTFB) · sitemap.xml · robots.txt · canonical · mobile viewport · language attribute · alt text coverage · Open Graph · broken links · structured data (JSON-LD) · LocalBusiness schema · NAP consistency

The paid side ($29/mo, free 14 days) re-runs the same audit every Monday and emails you ONLY when something regresses. No dashboard. The pitch is "I never want to log in to an SEO tool again, just tell me when my dev broke something."

What I'd love feedback on from people who actually do SEO for a living:

1. Anything obviously missing from the 13 check set for the kind of small-business sites that hire freelance/agency SEO?
2. Is "regression alert" actually a useful cadence, or do you prefer a weekly "here's the state of all checks" digest regardless?
3. Pricing read — $29/mo for the SMB segment, too high / too low / right?

Audit any URL: https://sitebeat.tech
```

**Tactics:**
- Don't reply with marketing-y language to questions. r/SEO mods watch for this.
- Be honest about what's missing. "Yeah I don't do CWV yet" is fine. "We're working on it" gets downvoted.
- If someone says it's a copy of Ahrefs/Semrush — agree, point at the price/scope difference, move on.

**Expected outcome:** Modest. r/SEO traffic converts at low single digits because it's mostly other SEOs, not SMB owners. The post is more for SEO/indie credibility + Google indexing the discussion.

---

## Backup surfaces if any of the three above flop

- **Indie Hackers — Show & Tell**: indiehackers.com/post (skipped earlier because gated; check if your account cleared).
- **r/SaaS** — friendlier than r/SEO for SaaS launches.
- **r/smallbusiness** — actual buyers; harder mods.
- **dev.to** — if Show HN flops, post a "I built X, here's the architecture" companion that links back.
- **Hacker News /newest** — if the front page submission stalls, drop the same URL in a comment on a related post (Ask HN about SEO tools, etc).

## Tracking

Every URL above uses sitebeat.tech raw (no UTM). You'll see them in audit attribution as `referrer = news.ycombinator.com`, `producthunt.com`, `reddit.com`. The funnel diagnostics already break down audits by source so we'll see traction quickly.
