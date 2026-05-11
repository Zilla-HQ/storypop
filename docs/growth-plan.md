# Restay growth plan

Single canonical playbook for unpaid + paid acquisition at Restay. Built from competitor research (PriceLabs, Wheelhouse, Beyond, Hospitable, Rankbreeze, OptimizeMyAirbnb, AirDNA, Rabbu) on 2026-05-06. Companion docs:

- `docs/MANUAL_CHECKLIST.md` — what only Jack can do (account UI work, recording, sending personal-relationship emails)
- `docs/ads-playbook.md` — paid-channel runbook (Meta/Google/Reddit) — pre-existing
- `docs/META_ADS_LAUNCH.md` — Meta launch operator-checklist — pre-existing
- `docs/outreach/affiliate-tier1.md` — Tier-1 affiliate outreach drafts (10 partners)
- `docs/outreach/podcast-sponsors.md` — podcast sponsor inquiries (3 podcasts)
- `docs/creative/reel-scripts.md` — 5 vertical UGC reel scripts

---

## Strategic frame — Restay's unfair edges

Competitor research surfaced four assets none of the major players have:

1. **Paid-friendly economics.** PriceLabs/Wheelhouse/Beyond/Rankbreeze all run subscriptions ($20/mo) where paid CAC math is brutal — they don't run Meta. Our $79 one-time means $20–25 CAC actually pencils. **Lean in before they copy.**
2. **Photo editing is uncontested.** Every audit competitor (Rankbreeze, OptimizeMyAirbnb, Smily) does copy/SEO only. AI photo restyle is our visual hook + before/after creative engine + moat.
3. **"Hasn't been updated in 12+ months" hook.** Every other tool talks generic "ranking factors." We can name the host's exact problem in cold email + ad creative, scrapeable from Airbnb's public listing data.
4. **No Rabbu-style listing grader exists.** AirDNA owns "what's my revenue"; Rabbu owns "what's this address worth." `/grade` for "is my listing any good" is wide open.

Everything below sequences against these.

---

## Top unpaid plays — ranked

### 1. Free public listing grader (`/grade`) — SHIPPED

Public no-auth page that scores any Airbnb listing 0–100 across copy / photos / signals + 3 named fixes. Runs lib/grader.ts → Claude vision + text scoring, ~$0.005/call, 4–8s response. Becomes the SEO surface, the lead magnet, and the Meta retargeting pool.

**Programmatic SEO layer:** 25 city-specific landing pages at `/grade/[city]` covering Nashville, Austin, Miami, NYC, Phoenix, Scottsdale, Orlando, Savannah, Charleston, Asheville, Denver, etc. Each is its own indexable page funneling into the grader. Sitemap is auto-emitted.

### 2. Affiliate program (`/partners`) — SHIPPED

30% of $79 = $23.70 per converted referral, paid weekly via Stripe. Better economics than every subscription affiliate in the space (PriceLabs 10%, Hospitable 25%, Wheelhouse 50% — but spread over months on $20/mo). Our payout is fast and one-shot.

Tier-1 outreach drafts in `docs/outreach/affiliate-tier1.md` cover Sean Rakidzich, Robuilt, Rusteen, Jasper Ribbers, TFV, Faeth, Avery Carl, Chang, Symon He, Lodgify.

### 3. SEO content — SHIPPED (5 articles live)

`/blog` index + 5 high-intent articles:
- Why isn't my Airbnb getting bookings in 2026
- Airbnb search ranking factors 2026
- Airbnb listing photos do's and don'ts
- How often should you update your Airbnb listing
- Is virtual staging allowed on Airbnb?

Each is a self-contained tsx page (no MDX dependency), inter-linked, with footer CTA into `/grade` + `/host`. Each indexes to sitemap.xml.

**Compounding plan:** ship 1 article/week for the next 60 days. Topics in order:
- "What Airbnb's algorithm cares about in 2026 (data, not speculation)"
- "Title formulas for the top 10 STR markets"
- "30-day pricing strategy for new Airbnb hosts"
- "Why your photos look phone-shot (and how to fix it without a photographer)"
- "Airbnb hero photo: what should it actually be?"
- "How to write an Airbnb description that actually converts"
- "Cancel-rate, response-rate, and the algorithm: a honest read"
- "When to switch from Airbnb to direct booking"

### 4. Reddit organic — MANUAL (Jack)

r/airbnb_hosts, r/AirBnBHosts, r/shorttermrentals get host-pain posts daily. The research called Reddit "essentially virgin" in this category.

30 min/day, 30-day plan in `docs/MANUAL_CHECKLIST.md`. Helpful-first, never promotional until the community knows your handle.

### 5. Podcast sponsorships — DRAFTS READY

Send order:
1. Thanks For Visiting / Hosting Hotline (best format-fit, no current dominant SaaS sponsor)
2. STR Unfiltered (Bill Faeth — operator-tier audience)
3. Get Paid For Your Pad (multi-sponsor slot since Hospitable already there)

Drafts in `docs/outreach/podcast-sponsors.md` with budget anchors.

---

## Top paid plays — ranked

### 1. Meta UGC video (already running, scaling now)

Existing `feat(ads)` infra is live with `meta-ads-lead-scaler` and `meta-ads-fatigue-check`. Just needs creative rotation. 5 reel scripts in `docs/creative/reel-scripts.md` for Jack to record.

### 2. Branded Google Ads defense — MANUAL (Jack)

$50/mo, set-and-forget. Bids on "Restay," "restay.agency." Cheapest highest-ROAS thing we can do. Steps in MANUAL_CHECKLIST.md.

### 3. Retargeting on `/grade` visitors

`/grade` ships a Meta CAPI Lead event on every grader run. Once we have 100+ daily grader uses, set up a Meta retargeting ad set targeting `Lead` users who didn't reach `Purchase` event. CPMs on warm audiences are $3–8 vs $15–25 cold.

Build trigger: when admin's grader-run-count for the past 7 days > 100, set up the retargeting campaign. Currently zero — defer.

### 4. YouTube preroll on Sean Rakidzich + Robuilt — MANUAL (Jack)

Direct host-intent traffic. Google Ads → Video → placements → specific channels (UC* IDs). $20/day cap, 7-day test. Steps in MANUAL_CHECKLIST.md.

### 5. STR Wealth Conference sponsorship (July, Nashville) — DEFER

Highest-density buyer event for our 1–5 listing ICP. Defer until 50+ paid Tune-Ups completed. $5k+ commitment, revisit early June.

---

## What to skip

- **TikTok / Instagram organic content.** Time-to-payoff too long for solo bandwidth. Revisit at 200+ paid customers.
- **Reddit *paid* ads.** Meta + Reddit-organic is the better pair. Reddit ads underperform in this niche.
- **Google Search ads on broad keywords** other than branded. Search volume thin, CPCs creeping. Skip until $500+/mo paid budget.
- **Building a Slack/Discord community.** Hospitable does it; doesn't drive their growth. Tax on solo time.
- **Cold IG/Twitter DMs to hosts.** Worse signal-to-noise than email outreach. Don't fragment.

---

## 30/60/90 sequencing (refresh: 2026-05-06)

### Days 0–30
- [x] Ship `/grade` public grader (lib/grader.ts + page)
- [x] Ship 25 city pages at `/grade/[city]`
- [x] Ship `/partners` affiliate page + application form
- [x] Ship `/blog` + first 5 articles
- [x] Ship sitemap.xml + robots.txt
- [ ] **Manual:** branded Google Ads ($50/mo) — 1h setup, see MANUAL_CHECKLIST
- [ ] **Manual:** record 5 UGC reels — 1 afternoon, see `docs/creative/reel-scripts.md`
- [ ] **Manual:** send 10 Tier-1 affiliate emails — 1h, see `docs/outreach/affiliate-tier1.md`
- [ ] **Manual:** Reddit organic — 30min/day, see MANUAL_CHECKLIST
- [ ] **Manual:** send 3 podcast sponsor inquiries — 30min, see `docs/outreach/podcast-sponsors.md`

### Days 31–60
- [ ] First Tier-2 affiliate batch (50 mid-tier coaches)
- [ ] First podcast sponsor drop on whichever Tier-1 podcast responded fastest
- [ ] Retargeting ad set on `/grade` visitors (only if grader traffic > 100/day)
- [ ] **Manual:** YouTube preroll test on Sean Rakidzich + Robuilt
- [ ] 5 more SEO articles published (one/week)
- [ ] Re-shoot Reel 1 (the workhorse) for fatigue rotation

### Days 61–90
- [ ] 10 more SEO articles + programmatic blog content
- [ ] Decide on STR Wealth Conference sponsorship based on cash + paid customer count
- [ ] Second podcast sponsor (different audience)
- [ ] Lookalike audiences in Meta (need 50+ Purchase events)
- [ ] Affiliate program tuning based on which coaches converted

---

## How to know it's working — metrics that matter

| Metric | Where | Healthy | Investigate |
|---|---|---|---|
| Grader runs/day | `restay.grader_run` PostHog event | >50 by day 30 | <10 = SEO not landing |
| Grader → /host conversion | `/admin` (grader_run → home_visited path) | >15% | <5% = grader CTA weak |
| Tier-1 affiliate reply rate | manual count from sent emails | 3+ replies of 10 | <2 = pitch needs sharpening |
| Cold-email reply rate | existing reply-handler tag count | >2% | <0.5% = list quality or copy issue |
| Meta Lead → Purchase | meta-ads-lead-scaler logs | conversion rate consistent | sustained >$7 CAC = fix or pause per existing scaler |
| SEO impressions (Google Search Console) | manual | >100 by day 30, >5k by day 90 | flat = thin content |
| Branded search clicks | Google Ads | >5 clicks/wk by day 14 | zero = competitors not bidding (good) |

---

## Cost model

Marginal monthly cost of running this entire plan once it's live:

| Channel | Cost | Notes |
|---|---|---|
| Meta paid (existing) | $2,250/mo | $75/day CBO, can scale to $200/day |
| Branded Google Ads | $50/mo | Set-and-forget |
| YouTube preroll test | $140/mo | $20/day × 7 days, run once |
| First podcast sponsor | $1,500–4,500/mo | Pilot 1–3 episodes |
| Grader compute (Anthropic) | ~$5/mo per 1k calls | Scales with traffic |
| Affiliate commissions | 30% of partner-driven revenue | Variable; pure margin if not paid |
| **Total fixed** | **~$2,400/mo** | |
| **Total scenario @ podcast sponsor** | **~$4,000–6,900/mo** | |

Affiliate + organic + SEO have zero cash cost — they trade against time.

---

## Hand-off

Two docs Jack actually opens day-to-day:

1. `docs/MANUAL_CHECKLIST.md` — the checklist of UI work and personal sends
2. `docs/growth-plan.md` (this file) — strategic frame, refreshed quarterly

Update the 30/60/90 checkboxes as items ship. When the plan refresh date is more than 60 days old, re-do the competitor sweep — STR-tools landscape moves fast.
