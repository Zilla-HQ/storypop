# StoryPop — launch playbook

StoryPop is a **paid-ads-driven B2C launch**, not a Show-HN / Product-Hunt-style launch. This doc captures the actual launch path: a 30-day pre-launch warm-up, a paid-ads phase, then SEO + organic compounding. The template's HN/PH content can be reused if/when we want to publish a "how StoryPop was built" piece — but that's a separate moment from the product launch itself.

---

## Phase 0 — pre-launch (3–4 weeks)

1. **Ship the production site at storypop.shop with all 6 sample books visible** (`/samples`). Until samples are visible, no ads run.
2. **Generate 50 hand-curated sample preview books** for staff/friends, real kids, real photos. Use the operator dashboard to manually rerun any pages that come out below the bar. The point is to calibrate the bar — what's "good enough to ship"?
3. **Meta + TikTok pixel + CAPI fired correctly.** Test events from prod with Meta's Event Manager Test Events view. Without this, the first $1k of spend is wasted.
4. **Stripe Tax configured + a few real tax IDs in the system** so the first real order doesn't blow up on a state-specific tax issue.
5. **Lulu print-job successfully fulfilled end-to-end at least once** — a single hardcover ordered through the live site and physically delivered. Take a photo when it arrives.
6. **Write Pip's first 3 diary entries** by hand (see [PERSONA.md](PERSONA.md)). These set the tone for everything downstream.
7. **First creative batch ready** — 5 Meta-spec videos + 5 carousels + 5 statics. See [AD_CREATIVES.md](AD_CREATIVES.md) for the brief. No UGC (founder won't record).

Exit criteria for Phase 0: site live, samples live, first real Lulu print received, Pixel + CAPI verified, first 15 creatives queued in Ads Manager.

---

## Phase 1 — paid traffic, calibrate (weeks 1–4 of launch)

The goal: **first 100 purchases**, mostly off cold Meta traffic.

### Channel mix

1. **Meta Ads (Facebook + Instagram)** — $100/day starting budget, scale to $300/day by week 3 if ROAS holds above 1.5.
   - 3 ad sets to start: lookalike-stub (broad), interest-stack (mom-blog + gift-personalized + picture-book), and Reels auto-placement.
   - 5 ad creatives per set. Rotate weekly based on CTR.
2. **TikTok Ads** — $25/day, mostly auto-targeting. Test 5 demo-style videos. No UGC.
3. **Friends + family soft launch** — 100 personal DMs in week 1. The goal is reviews + word-of-mouth, not direct revenue. Discount code `LAUNCH50` (50% off, capped at 100 redemptions) to early supporters.

### Don't run

- Google Search ads. CPCs against Wonderbly + Hooray Heroes are $3–8. Bad math.
- Reddit + X. Not the audience.

### What to measure

| Metric | Week-4 target |
|---|---|
| Total purchases | >100 |
| Blended ROAS | >1.5 |
| Preview-to-purchase | >8% |
| Refund rate | <3% |
| AOV | >$25 |

If ROAS is below 1.0 at week 2: pause spend. The fix is creative, not budget.

### What to publish

- Pip's diary, weekly, every Friday morning. Real books that shipped this week, anonymized (no real kid names; "a kid named [archetype-typical name]") unless the parent shares publicly first.
- TikTok organic 3×/week. Mix of AI-narrated demo-style + screen-recordings of the create flow.
- No SEO blog posts yet. SEO content starts in Phase 2 once we have content that wasn't an ad.

---

## Phase 2 — scale + SEO compounding (weeks 5–12)

If Phase 1 hits targets, scale spend to $1K/day blended (Meta + TikTok). Add Pinterest at $25/day as a Q4-prep test.

New surfaces:

1. **`/for/[occasion]` programmatic SEO pages** — "personalized book for 5-year-old's birthday", "first-day-of-school gift book", "new baby brother book". 60–80 pages, each indexed.
2. **`/samples/[archetype]` deep gallery pages** — one per archetype with 10+ preview books, optimized for "personalized [archetype] book" long-tail.
3. **Email retention loop** — purchasers get a "what's next" email 30 days after delivery (sibling book? birthday next year?). Strict TCPA: no SMS yet without affirmative consent.
4. **First "story behind the book" longform post** — Pip-voiced, ~1,500 words, about how the first 100 books got made. SEO-worthy + linkable.

### Exit criteria

- 500 books shipped cumulative
- Blended ROAS >2.0
- Lookalike audience built off >100 real purchases
- First organic SEO traffic (>500 visitors/mo from non-paid)

---

## Phase 3 — Q4 ramp (mid-Oct to mid-Dec)

Q4 is the year. Plan from week 30 onward:

1. **Hold creative pipeline open from August.** Q4 needs 30+ fresh creatives to avoid Meta fatigue. Start producing in August.
2. **Pre-warm a Black Friday audience** — start retargeting visitors from October on. They convert in November.
3. **Scale spend 3–5× through the season.** Daily budget caps at $5K Meta + $1K TikTok by November 15. ROAS will dip from 2.0 to 1.3–1.7 — acceptable for the volume, painful for margins.
4. **Print partner capacity check.** Confirm Lulu can handle the ramp. Have Printful as backup for hardcover SKU. Set "order by Dec 15 for Christmas delivery" cutoff hardcoded in `lib/lulu.ts:shippingCutoff`.
5. **Gift card SKU**, if it's built — heavy promotion. Gift cards convert at 90% redemption inside 90 days and bridge the "I don't have the kid's photo at this moment" gap that kills gift-conversion otherwise.

### Don't do during Q4

- **No major site redesigns.** Q4 conversions on a tested funnel are sacred. Lock the funnel from October 1; ship only critical fixes.
- **No new SKU launches.** The bundle SKU should be live by September if it's launching at all.

---

## What StoryPop does NOT do at launch

- **No Product Hunt as a sales channel.** PH is fine for the "we built this" moment but doesn't convert kid-gift buyers. Maybe a week-of-launch PH post for Zilla-network visibility — not as a revenue driver.
- **No Show HN.** Save it for "how we built it" content.
- **No UGC creator program.** Founder won't record; no creator program in v1. (Possibly in Phase 3 if a parent organically posts their kid with the book and we want to amplify.)
- **No influencer marketing.** Too expensive vs paid ads at v1 spend levels. Revisit when ROAS-fatigue forces us off cold paid.

---

## When something goes wrong

- **Meta ad account suspension.** Almost certain to happen once. Mitigation: account lives under Zilla BM `1952475115474490` so it inherits BM trust. Backup ad account warmed under same BM, ready to flip. Don't appeal angry; appeal with calm, specific compliance evidence.
- **Refund rate spikes above 5%.** Usually a character-mismatch issue (LoRA drifting). Pause generation, sample 20 recent flagged books, identify the failure mode, push a fix to `lib/falai.ts:lockCharacter`.
- **Lulu print delays during Q4.** Communicate proactively. Email every order shipping late with a real apology and an option for a digital-PDF refund-credit of $14.99.
- **Content-safety incident.** A book ships with disallowed content (branded character, violence, etc.) that slipped the gate. Pause generation immediately, audit `lib/claude.ts:storySafetyGate`, refund the customer, post-mortem in 24h.

---

## A note on which channels never make sense for StoryPop

- **Cold outreach (the merchant template's default).** B2C consumer product; there's no list of "people who buy personalized kids books" to cold email. The discovery layer is deleted in this repo.
- **LinkedIn ads.** No.
- **B2B partnerships with schools/daycares in v1.** It's tempting (volume!) but the operational complexity (bulk discounts, invoicing, custom co-branding) sinks margin and distracts from the consumer flywheel. v2 maybe.

The single non-negotiable: **the buyer is always the parent, never the kid.** Every channel choice respects that.
