# Launch day — HN / Product Hunt / Reddit playbook

The single most asymmetric day in a new merchant's life is launch. A successful Show HN or PH top-5 can deliver weeks of paid-ad spend in 24 hours. A botched one tanks momentum and burns the only "first announcement" you ever get.

This is the runbook that worked for the reference [Sitebeat](https://github.com/Zilla-HQ/sitebeat) merchant. The templates are copy-pasteable; the tactics generalize to any merchant.

> **Important constraint**: launch submissions must come from a human account, not the autonomous loop. HN, PH, and Reddit all flag-detect bots. The operator submits; the platform handles inbound traffic.

---

## Order of operations

The 3 surfaces don't compete — they reach different audiences and reinforce each other. Stagger them so you have hands free for each:

1. **Show HN** — Tuesday/Wednesday/Thursday, 8–10 PM Pacific (catches US evening + EU/AU morning).
2. **Product Hunt** — schedule the listing the night before, fire at 12:01 AM Pacific the next day. PH ranks by upvote velocity over a single calendar day, so you want a full 24-hour window.
3. **Reddit (r/SaaS or vertical sub)** — any time the same week. Read the sidebar twice. r/SEO, r/realestate, r/Entrepreneur all have aggressive mods.

---

## 1. Show HN

URL: <https://news.ycombinator.com/submit>

### Title format

Keep it short and honest. HN strips marketing language and will tank you for hype words. The "I built X that does Y" pattern works:

```
Show HN: <Merchant> – I built <thing> that <does specific thing>
```

Bad: `Show HN: <Merchant> – AI-powered, autonomous, next-generation X for Y`
Good: `Show HN: <Merchant> – I built an SEO monitor that emails only when something regresses`

### Body text

Optional — HN posters sometimes submit a URL with no text. A thoughtful 200-300-word intro lifts engagement. Structure:

1. **The job-to-be-done** (1 paragraph) — what existing tools fail at. Specific, not generic.
2. **What the merchant does** (1 paragraph) — concrete features, no marketing voice.
3. **Pricing + stack** (1 sentence each) — HN wants to know if you can build it and run it.
4. **3 questions you'd love feedback on** — gives commenters a hook. People love being asked their opinion.

End with the bare URL on its own line.

### Tactics

- Submit between **8–10 PM Pacific** (catches both US Pacific evening and AU/EU morning).
- **First-hour activity matters**. Refresh the page; comment on adjacent posts to stay visible.
- **Don't ask friends to upvote.** HN flag-detects ring voting and will silently dead-list your post.
- **Be present in the thread for 4–6 hours after posting.** Reply to every comment. That's the signal HN ranks on.
- **Don't post the same URL twice.** If a Show HN flops, change the URL (e.g. `?ref=hn-v2`) before trying again. Better: use a backup surface.

### Expected outcome

If it gains traction: 500–3000 visits in 24h. Conversion expectation: 1–3% to paid trial = 5–90 trials, of which 30–50% convert at end of trial = 1–45 customers.

If it flops (most do): ~50 visits, no comments. Pivot to PH the next morning.

---

## 2. Product Hunt

URL: <https://www.producthunt.com/products/new>

### Schedule, don't fire

PH submissions are scheduled, not instant. Submit the listing **the night before**, schedule it for **12:01 AM Pacific** the next morning. PH ranks by upvote velocity in the first 6 hours of a single calendar day, so you want a full 24-hour window.

### Listing fields

- **Tagline** (60-char limit): one concrete sentence about the merchant's hook.
- **Description** (~600 chars): same JTBD framing as the Show HN body. Skip pricing — PH visitors expect a CTA, not a quote.
- **First comment** (post as a comment on your own launch within the first hour): the longer "maker's note." This is where you ask for feedback on the 3 specific questions.

### Tactics

- **Tag 3–5 makers as "hunters"** in your launch (PH lets you credit collaborators). Doesn't need to be famous — just engaged.
- **DM 10–20 PH friends in the 48 hours before** — ask them to drop in on launch day, not for an upvote. PH penalizes upvote requests.
- **Reply to every comment within 30 min** during peak hours (6 AM–4 PM Pacific).
- **Don't post in PH's Slack/Discord asking for votes** — it gets you flagged and possibly removed.

### Expected outcome

Top 5 product of the day → 200–800 visits. Top 10 → ~150–400. Trial conversion ~5–15% (PH audience is high-intent makers + indie hackers).

---

## 3. Reddit launch post

Pick the most-relevant subreddit for your merchant's vertical. Read its sidebar twice. Sidebar rules override everything below.

### Subreddit selection by vertical

- **SaaS / indie / dev merchants**: r/SaaS (140K), r/SideProject (200K), r/indiehackers (40K).
- **SMB / local-business merchants**: r/smallbusiness (1.4M), r/Entrepreneur (3.6M).
- **Vertical-specific** (best converting): the merchant's exact vertical. Examples: r/restaurateur, r/HVAC, r/Plumbing, r/Roofing, r/realestate, r/Landscaping. Smaller but every member is a buyer.
- **Tool-curious**: r/Marketing, r/SEO, r/webdev. These are mostly other practitioners, not buyers — lower conversion but useful for indexing the discussion.

### Post shape

- **Title**: question or specific claim. **Not** a "we just launched" announcement (those get downvoted to oblivion on every subreddit larger than 100K).
- **Body**: open with "Solo dev, built this over the last N weeks." Honesty buys credibility.
- **List your features as a bullet list, not prose** — Reddit readers skim.
- **End with 2–3 specific questions you'd love feedback on.**
- **Drop the URL once, plain text**, no UTM. Reddit detects UTM-stuffed links.

### Tactics

- **Don't reply with marketing-y language to questions.** Mods watch for this.
- **Be honest about what's missing.** "Yeah I don't do X yet" lands better than "we're working on it."
- **If someone says it's a copy of an established product** — agree, point at the price/scope difference, move on. Defensive replies tank threads.
- **r/SEO + similar** have a loose "Sundays only for self-promotion" rule. Tools with a free tier and no paywall are tolerated weekdays *if* framed as a tool share, not a sales pitch.

### Expected outcome

Modest in absolute traffic (50–500 visits) but high-intent. Reddit traffic also gets indexed and ranks for relevant queries — a successful r/SEO post can deliver organic traffic for years.

---

## Backup surfaces if any of the 3 flop

- **Indie Hackers — Show & Tell**: <https://indiehackers.com/post>.
- **r/SaaS** — friendlier than vertical-specific subs for SaaS launches.
- **dev.to** — if Show HN flops, post a companion "I built X, here's the architecture" that links back.
- **Hacker News /newest** — if the front page submission stalls within 30 minutes, drop the same URL in a comment on a related Ask HN ("what are you using for SEO monitoring?", etc.). Don't repost; the dupe-detector will catch it.

---

## Tracking

Use the **bare merchant URL** on every surface. No UTMs. Trackers like UTMs flag Reddit / PH posts as ads, and HN strips them. Your audit / lead-form table already captures `referrer` — that's enough attribution to see traction by source.

The exception: **paid Reddit Ads** (see REDDIT_ADS.md) — those use UTMs because they're not organic posts.

---

## Day-after plan

If you broke 500 visits on launch day, ride the wave:

1. **Schedule a follow-up tweet thread** for the next morning — "Yesterday I launched X. Here are the 5 most common reactions I got."
2. **Email your existing list** (if you have one) the next afternoon, not the same day. Use the launch as the news hook.
3. **Pin the launch post** on the merchant's X account for 48h.

If the launch flopped:

1. **Don't repost the same URL.** HN, PH, and Reddit all dupe-detect.
2. **Don't lower the price as a panic move.** Wait 2 weeks before any pricing change.
3. **Pivot to paid acquisition** — Meta Ads (META_ADS.md) + Reddit Ads (REDDIT_ADS.md) — and use the launch URLs as control creatives.

---

## Reference templates

The Sitebeat merchant published its actual launch posts at [`docs/launch-posts.md`](https://github.com/Zilla-HQ/sitebeat/blob/main/docs/launch-posts.md). Real copy from a real $29/mo SaaS launch — adapt the structure, replace the product specifics.
