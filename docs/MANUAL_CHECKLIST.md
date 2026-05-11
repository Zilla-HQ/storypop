# Restay growth — manual checklist

Things only you can do — third-party UI logins, content recording, personal-relationship emails. Everything else is built; this is what's left for the operator.

Order is rough priority. Each item lists time, what to do, and where the matching code/copy lives.

---

## This week (~3 hours total)

### 1. Branded Google Ads (~30 min, $50/mo budget)

The cheapest, highest-ROAS thing you can ship. Blocks competitors bidding on your brand and catches direct-intent searches.

1. Sign in at https://ads.google.com with the Zilla-HQ Google account
2. **New campaign** → Goal: **Website traffic** → Type: **Search** → URL: `https://restay.agency`
3. Skip Smart Bidding upsell → choose **Manual CPC** later
4. Settings:
   - Networks: Search Network only — uncheck Display
   - Locations: United States
   - Budget: $2/day → $60/mo
   - Bidding: Manual CPC, max CPC = $1.50 (branded terms are cheap)
5. **Single ad group**, exact-match keywords:
   ```
   [restay]
   [restay agency]
   [restay airbnb]
   [restay listing]
   "restay.agency"
   ```
6. Negative keywords: `free`, `job`, `app`, `clothing`, `download`
7. Responsive Search Ad — 8 headlines:
   - `Restay — Airbnb Listing Tune-Up`
   - `Free Listing Audit, No Signup`
   - `Rewrite, Restyle, Reprice — $79`
   - `Less Than a Month of Guesty`
   - `Restay Official Site`
   - `4-Hour Airbnb Optimization`
   - `Edit-Only Photos, Airbnb Safe`
   - `Get Your Free Listing Grade`
8. 3 descriptions:
   - `Paste your URL. Get an instant audit, restyled photo, and pricing comp scan. Free.`
   - `One-time $79 — rewritten copy, 10 edited photos, 30-day pricing report. No subscription.`
   - `Refund within 14 days. Edit-only photos. Originals always retained.`
9. Final URL: `https://restay.agency/?utm_source=google&utm_medium=cpc&utm_campaign=branded_v1`

Conversion tracking already set up via `NEXT_PUBLIC_GOOGLE_ADS_ID` if env is set; if not, follow `docs/ads-playbook.md` Section 1.

### 2. Record 5 UGC reels (1 afternoon)

Scripts at `docs/creative/reel-scripts.md`. The 5 reels can be recorded in one afternoon — same setup, same lighting, just different scripts.

**Order to shoot:**
1. Reel 1 — "Paste your URL" demo (workhorse)
2. Reel 3 — "I haven't updated in 18 months" voiceover (highest-converting variant)
3. Reel 2 — "Before/after" photo flip (uses existing R2 samples)
4. Reel 5 — "What guests see" split-screen
5. Reel 4 — testimonial **slot left empty** until 5 paid customers exist

**After recording, upload via existing scripts:**
```bash
npx tsx --env-file=.env.local scripts/meta-upload-page-video.ts ./reel-1.mp4
# prints video_id, then:
npx tsx --env-file=.env.local scripts/meta-create-ads.ts <video_id>
```

Edit `scripts/meta-create-ads.ts` `VARIANTS` const before running so the captions match each reel's intent.

### 3. Send 10 Tier-1 affiliate emails (~1 hour)

Drafts at `docs/outreach/affiliate-tier1.md`. Personalize each email's opening observation before sending — every draft has one specific thing that proves you watched/listened. Make it current (their latest video/episode/post).

Send from your real email (jack@seifdn.org or jack@restay.agency), not a template alias. These are personal-relationship plays. **Do NOT BCC**, and don't send all 10 in the same minute — space them across the day.

7-day rule: one bump email if no reply, then drop it. Don't spam.

### 4. Send 3 podcast sponsor inquiries (~20 min)

Drafts at `docs/outreach/podcast-sponsors.md`. Send order:
1. Thanks For Visiting / Hosting Hotline → `hello@thanksforvisiting.com`
2. STR Unfiltered → `bill@billfaeth.com`
3. Get Paid For Your Pad → `jasper@getpaidforyourpad.com`

Send Thursday/Friday morning. Sponsor inboxes are emptiest end-of-week.

### 5. Reddit organic — start the 30-day clock (30 min/day for 30 days)

Use a personal Reddit account, not a brand account. Goal: become a recognized helpful voice in r/airbnb_hosts (180k), r/AirBnBHosts, r/shorttermrentals.

**Ground rules:**
- Answer 1–3 host-pain posts per day with substance (5+ sentences each)
- Mention Restay only when directly asked, OR when you can offer a free `/grade` that's directly responsive
- Never link-spam, never reply with "DM me," never post a top-level promotional post in week 1

**Day 30** — once mods know your handle, do ONE top-level post in r/airbnb_hosts: "I built a free tool that grades Airbnb listings. Free, no signup. Happy to grade yours and explain the score." That post has measurably driven traffic for similar tools (the AirDNA + Rabbu pattern).

---

## Next 30 days (when bandwidth allows)

### 6. YouTube preroll test on Sean Rakidzich + Robuilt (~30 min setup, $140 spend)

1. https://ads.google.com → New campaign → Goal: **Brand awareness**
2. Type: **Video** → Subtype: **Skippable in-stream**
3. Budget: $20/day, 7 days
4. Targeting:
   - Locations: US
   - Placements: **Specific YouTube channels** → search and add:
     - "Airbnb Automated" (Sean Rakidzich)
     - "Robuilt"
     - "Michael Chang"
5. Bidding: Maximum CPV, target $0.10
6. Creative: upload Reel 3 (the "18 months" voiceover) since it's the highest-converting variant
7. Final URL: `https://restay.agency/grade?utm_source=youtube&utm_medium=cpv&utm_campaign=channel_targeting&utm_content=rakidzich_test`

Kill criteria after 7 days: if 0 grader runs from `utm_source=youtube`, channel targeting isn't matching real intent. Don't chase.

### 7. Meta retargeting on /grade visitors (~30 min, only if grader traffic > 100/day)

Already wired: `/grade` fires CAPI `Lead` events. Once you have a meaningful warm pool:

1. Meta Ads Manager → New campaign → Sales → CBO off
2. Audience → Custom Audience → Pixel → "Lead" event in last 30 days
3. Exclusion: anyone who fired Purchase
4. Budget: $10/day
5. Creative: re-use Reel 1 + Reel 4 (testimonial) — warm audiences convert on social proof

### 8. STR Wealth Conference (July, Nashville) — defer decision until early June

Buyer-segment density of the year. Sponsorship range $5k–25k. Decision rule: if you've cleared 50 paid Tune-Ups by June 1, sponsor; if not, defer to 2027. `sponsor@strwealthconference.com`.

---

## Daily / weekly cadence

### Daily (5 min, weekdays)
- Glance `/admin` dashboard for grader runs, paid orders, Meta CAC
- Triage replies in your inbox (Tier-1 affiliate, podcast sponsor, paid customer)

### Weekly (30 min, Sundays)
- Send 1 SEO article (drafts compounding from `lib/blog.ts`)
- Refresh Meta creative if `meta-ads-fatigue-check` flagged anything > freq 2.5
- Pay any earned partner commissions via Stripe (manual until 10+ active partners)

### Monthly
- Re-grade your own listings to make sure the grader's still calibrated
- Pull 7-day numbers per channel; cut any with 0 attributed orders

---

## Resources living in the repo

| What | Where |
|---|---|
| Strategic frame + 30/60/90 | `docs/growth-plan.md` |
| This checklist | `docs/MANUAL_CHECKLIST.md` |
| Meta launch ops | `docs/META_ADS_LAUNCH.md` |
| Channel runbook | `docs/ads-playbook.md` |
| Tier-1 affiliate drafts | `docs/outreach/affiliate-tier1.md` |
| Podcast sponsor drafts | `docs/outreach/podcast-sponsors.md` |
| Reel scripts | `docs/creative/reel-scripts.md` |
| Public grader code | `app/(marketing)/grade/page.tsx`, `lib/grader.ts`, `app/api/grade/route.ts` |
| City SEO pages | `app/(marketing)/grade/[city]/page.tsx`, `lib/cities.ts` |
| Affiliate page | `app/(marketing)/partners/page.tsx` |
| Blog | `app/(marketing)/blog/`, `lib/blog.ts`, `components/marketing/blog-bodies.tsx` |
| Sitemap / robots | `app/sitemap.ts`, `app/robots.ts` |
