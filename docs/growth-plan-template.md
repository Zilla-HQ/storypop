# `{{MERCHANT}}` growth plan

Single canonical playbook for unpaid + paid acquisition at `{{MERCHANT}}`. Built from competitor research on `{{LAUNCH_DATE}}`. Refresh quarterly.

Companion docs:
- [`docs/operator-playbook-template.md`](./operator-playbook-template.md) — what only the operator can do (account UI work, recording, sending personal-relationship emails)
- [`META_ADS.md`](../META_ADS.md) — paid Meta runbook
- [`GOOGLE_ADS.md`](../GOOGLE_ADS.md) + [`GOOGLE_ADS_OPERATOR.md`](../GOOGLE_ADS_OPERATOR.md) — branded-defense + Search expansion
- [`docs/outreach/affiliate-tier1-template.md`](./outreach/affiliate-tier1-template.md) — Tier-1 affiliate outreach drafts
- [`docs/outreach/podcast-sponsors-template.md`](./outreach/podcast-sponsors-template.md) — podcast sponsor inquiries
- [`docs/creative/reel-scripts-template.md`](./creative/reel-scripts-template.md) — UGC vertical reel scripts

> **Reference:** Restay's filled-in version lives at [`Zilla-HQ/airbnb/docs/growth-plan.md`](https://github.com/Zilla-HQ/airbnb/blob/main/docs/growth-plan.md).

---

## Strategic frame — `{{MERCHANT}}`'s unfair edges

(Competitor research output goes here. Try to surface 3–4 assets none of the major players have. For Restay's reference:

1. **Paid-friendly economics.** Competitors all run subscriptions where paid CAC is brutal. Our one-time fee means $20–25 CAC actually pencils. Lean in before they copy.
2. **The visual moat.** Photo / image-edit competitors do copy-only; copy competitors do words-only. The "all-in-one bundle" is our hook.
3. **The named-problem cold hook.** Generic "ranking factors" talk doesn't convert. Naming the exact problem in the recipient's listing (scrapeable from public data) does.
4. **Whitespace in the {{lead-magnet category}}.** No one else does a 60-second free audit/grader on the recipient's actual artifact.

Everything below sequences against these.)

---

## Top unpaid plays — ranked

### 1. Free public grader / audit (`/grade`) — see [RESTAY.md](../RESTAY.md#free-public-grader--audit-funnel)
Public no-auth page that scores any recipient artifact 0–100 across `{{DIMENSIONS}}` + 3 named fixes. Becomes the SEO surface, the lead magnet, and the Meta retargeting pool.

**Programmatic SEO layer:** city-specific landing pages at `/grade/[city]` covering `{{LIST_OF_CITIES}}`. Each indexable.

### 2. Affiliate program (`/partners`)
`{{COMMISSION_PERCENT}}%` of `${{ASP}}` = `${{COMMISSION_$}}` per converted referral, paid weekly via Stripe.

Tier-1 outreach drafts in [`docs/outreach/affiliate-tier1-template.md`](./outreach/affiliate-tier1-template.md).

### 3. SEO content (`/blog`)
Ship 1 article/week for the next 60 days. Topics: `{{HIGH_INTENT_SEO_TOPICS}}`. Each is a self-contained tsx page (no MDX dependency), inter-linked, with footer CTA into `/grade` + `/host`. Each indexes to sitemap.xml.

### 4. Reddit organic — MANUAL (operator)
`{{TARGET_SUBREDDITS}}` get pain posts daily. The competitive research called Reddit "essentially virgin" in `{{NICHE}}`.

30 min/day, ongoing plan in `docs/MANUAL_CHECKLIST.md`. Helpful-first, never promotional until the community knows your handle.

### 5. Podcast sponsorships
Send order:
1. `{{PODCAST_1}}` (best format-fit, no current dominant SaaS sponsor)
2. `{{PODCAST_2}}` (operator-tier audience)
3. `{{PODCAST_3}}` (multi-sponsor slot — already someone else there, but room)

Drafts in [`docs/outreach/podcast-sponsors-template.md`](./outreach/podcast-sponsors-template.md) with budget anchors.

---

## Top paid plays — ranked

### 1. Meta UGC video — see [META_ADS.md](../META_ADS.md)
5 reel scripts in [`docs/creative/reel-scripts-template.md`](./creative/reel-scripts-template.md) for operator to record. Rotate every 2 weeks for fatigue.

### 2. Branded Google Ads defense — MANUAL (operator)
$50/mo, set-and-forget. Bids on `{{MERCHANT}}`, `{{MERCHANT}}.tld`. Cheapest highest-ROAS thing we can do. Steps in [`GOOGLE_ADS_OPERATOR.md`](../GOOGLE_ADS_OPERATOR.md).

### 3. Retargeting on `/grade` visitors
`/grade` ships a Meta CAPI `Lead` event on every grader run. Once we have 100+ daily grader uses, set up a Meta retargeting ad set targeting `Lead` users who didn't reach `Purchase`. CPMs on warm audiences are $3–8 vs $15–25 cold.

**Build trigger:** when admin's grader-run-count for the past 7 days > 100, set up the retargeting campaign.

### 4. YouTube preroll on hand-picked channels — MANUAL (operator)
Direct intent traffic. Google Ads → Video → placements → specific channels (UC* IDs). $20/day cap, 7-day test.

### 5. `{{LARGE_CONFERENCE}}` sponsorship — DEFER
Highest-density buyer event for `{{ICP}}`. Defer until 50+ paid customers completed. `${{X}}k+` commitment, revisit at `{{DATE}}`.

---

## What to skip

(Restay's: TikTok / Instagram organic content, Reddit paid ads, Google Search ads on broad keywords other than branded, building a Slack/Discord community, cold IG/Twitter DMs.)

- **{{SKIP_1}}.** {{WHY_1}}
- **{{SKIP_2}}.** {{WHY_2}}
- **{{SKIP_3}}.** {{WHY_3}}

---

## 30/60/90 sequencing (refresh: {{DATE}})

### Days 0–30
- [ ] Ship `/grade` public grader (lib/grader.ts + page)
- [ ] Ship `{{N}}` city pages at `/grade/[city]`
- [ ] Ship `/partners` affiliate page + application form
- [ ] Ship `/blog` + first 5 articles
- [ ] Ship sitemap.xml + robots.txt
- [ ] **Manual:** branded Google Ads ($50/mo) — 1h setup
- [ ] **Manual:** record 5 UGC reels — 1 afternoon
- [ ] **Manual:** send 10 Tier-1 affiliate emails — 1h
- [ ] **Manual:** Reddit organic — 30min/day
- [ ] **Manual:** send 3 podcast sponsor inquiries — 30min

### Days 31–60
- [ ] First Tier-2 affiliate batch (50 mid-tier creators)
- [ ] First podcast sponsor drop on whichever Tier-1 responded fastest
- [ ] Retargeting ad set on `/grade` visitors (only if grader traffic > 100/day)
- [ ] **Manual:** YouTube preroll test on hand-picked channels
- [ ] 5 more SEO articles published (one/week)
- [ ] Re-shoot Reel 1 (the workhorse) for fatigue rotation

### Days 61–90
- [ ] 10 more SEO articles + programmatic blog content
- [ ] Decide on `{{LARGE_CONFERENCE}}` sponsorship based on cash + paid customer count
- [ ] Second podcast sponsor (different audience)
- [ ] Lookalike audiences in Meta (need 50+ Purchase events)
- [ ] Affiliate program tuning based on which creators converted

---

## How to know it's working — metrics that matter

| Metric | Where | Healthy | Investigate |
|---|---|---|---|
| Grader runs/day | PostHog `{{MERCHANT}}.grader_run` event | >50 by day 30 | <10 = SEO not landing |
| Grader → /host conversion | `/admin` path analysis | >15% | <5% = grader CTA weak |
| Tier-1 affiliate reply rate | manual count | 3+ of 10 | <2 = pitch needs sharpening |
| Cold-email reply rate | reply-handler tag count | >2% | <0.5% = list quality or copy issue |
| Meta Lead → Purchase | meta-ads-lead-scaler logs | sustained CAC < `${{TARGET_CAC}}` | sustained CAC > `${{TARGET_CAC}}` = fix or pause |
| SEO impressions (GSC) | manual | >100 by day 30, >5k by day 90 | flat = thin content |
| Branded search clicks | Google Ads | >5 clicks/wk by day 14 | zero = competitors not bidding (good) |

---

## Cost model

| Channel | Cost | Notes |
|---|---|---|
| Meta paid | `${{META_BUDGET}}/mo` | Can scale to `${{MAX_META_BUDGET}}/mo` |
| Branded Google Ads | $50/mo | Set-and-forget |
| YouTube preroll test | $140/mo | $20/day × 7 days, run once |
| First podcast sponsor | `${{X}}–${{Y}}/mo` | Pilot 1–3 episodes |
| Grader compute (Anthropic) | ~$5/mo per 1k calls | Scales with traffic |
| Affiliate commissions | `{{COMMISSION_%}}` of partner-driven revenue | Variable; pure margin if not paid |
| **Total fixed** | **`~${{TOTAL_FIXED}}/mo`** | |

Affiliate + organic + SEO have zero cash cost — they trade against time.

---

## Hand-off

Two docs the operator actually opens day-to-day:

1. `docs/MANUAL_CHECKLIST.md` — the checklist of UI work and personal sends
2. `docs/growth-plan.md` (this file) — strategic frame, refreshed quarterly

Update the 30/60/90 checkboxes as items ship. When the plan refresh date is more than 60 days old, re-do the competitor sweep — your category's landscape moves fast.
