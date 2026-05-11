# StoryPop — ICP framework, filled in

StoryPop is a **paid-ads-driven B2C product**, not a cold-outreach business. The "ICP framework" in the merchant template was built around cold outreach; for StoryPop, the analogous discipline is **audience targeting on Meta and TikTok**, plus the SEO and gift-discovery funnels.

This doc translates the four-filter framework to StoryPop's paid-ads context. Pattern reference: [Sitebeat](https://github.com/Zilla-HQ/sitebeat) shows what happens when you target the wrong audience — the lesson generalizes.

---

## The four filters, applied to paid-ads audiences

### 1. Price tolerance

- **$14.99 PDF**: impulse-priced. Any parent on Meta/TikTok can buy on a Friday night. ✅
- **$29.99 softcover**: still impulse-tier, especially for gifts. ✅
- **$44.99 hardcover**: gift-priced. Aunt / grandparent buys. ✅
- **$69.99 gift bundle**: birthday / Christmas / baby-shower priced. Still passes for gifters; not impulse. ✅

Pricing passes across all SKUs for the gifting use case.

### 2. Decision authority

Who's actually buying?

- **Parents (mom, primarily)**: self-determined. ✅
- **Grandparents (gifters)**: self-determined. Highest AOV (skews toward hardcover + bundle). ✅
- **Aunts/uncles (gifters)**: self-determined. Volume-driver around birthdays + holidays. ✅
- **Kids themselves**: do not have the credit card. ❌ — and we wouldn't sell to them if they did. (See `app/(marketing)/disclosure/page.tsx` — COPPA stance.)

### 3. Pain / motivation visibility

This is "is the buyer in a buying mood when the ad hits."

- **Pre-birthday window (-3 weeks to -3 days)**: very high intent. Best ROAS. ✅
- **Pre-Christmas window (mid-Oct to Dec 15)**: highest volume of the year. Saturated, expensive CPMs, but converts. ✅
- **Baby-shower / new-sibling moments**: triggered by life events. Lookalike + interest-targeting reaches well. ✅
- **Bedtime / "what to read tonight" search intent**: low purchase intent at moment of search; better for SEO / content top-of-funnel than for paid ads. ⚠️
- **General "kid stuff" browsing**: too diffuse, wasteful in v1. ❌

### 4. Channel fit

- **Meta (Facebook + Instagram)**: where parents are. Reels + carousel work. Lookalikes off purchasers convert hard once we have >50 purchases as a seed audience. ✅
- **TikTok**: gift-discovery scrolling, especially around Q4 + birthday-week content. Short-form demo videos (NOT user-recorded UGC for StoryPop — see voice notes in [AD_CREATIVES.md](AD_CREATIVES.md)). ✅
- **Google Search**: "personalized kids book" + "custom story for [name]" — small but high-intent volume. Best for SEO landing pages, not paid (CPC too high vs Meta). ⚠️
- **Pinterest**: gift-discovery moment. Strong for hardcover + bundle. ✅ — secondary, test after Meta scales.
- **Email**: only post-purchase + abandoned-cart. No cold list. ✅

---

## StoryPop's ICP — filled-in table

| Filter | Mom-buyer (self) | Grandparent gifter | Aunt/uncle gifter | Baby-shower buyer |
|---|---|---|---|---|
| Price tolerance | $14.99–44.99 OK | $29.99–69.99 (prefers hardcover + bundle) | $29.99–69.99 | $44.99–69.99 |
| Decision authority | Self | Self | Self | Self |
| Pain / motivation window | Bedtime, birthday, "they're growing up so fast" | Birthday, Christmas, "I miss them" | Birthday, "good aunt energy" | Baby shower invite |
| Channel fit | Meta Reels, TikTok | Meta feed + carousel | Meta Reels + Pinterest | Meta + Pinterest |
| **Verdict** | **Primary — scale first** | **Highest-AOV — scale second** | **Volume in Q4 + birthday-month** | **Niche evergreen, run small** |

---

## Targeting strategy v1

**Meta (primary, ~80% of spend):**

- **Audience 1 — Lookalike off purchasers** (post first 50 sales). Cold-best on day 30+.
- **Audience 2 — Interest stack: "Mom blog" + "Picture book authors" + "Etsy gifting" + "Personalized gifts"** — interest mix that under-indexes on price-sensitive sub-audiences.
- **Audience 3 — Engaged shoppers on Reels** (Meta's auto-targeting placement option, capped at $50/day).
- **Audience 4 — Q4 gift seasonality lookalike** — reactivate in mid-October.

**TikTok (secondary, ~15%):**

- Auto-targeting bid; let the algo find the buyer. Demo-style videos (show pages turning, character matching the photo). No UGC.

**Pinterest (5%, test):**

- Gift-board boards. Run a single hardcover-bundle campaign at $25/day for 30 days; measure attributable conversions.

**Don't run:**

- Google Search ads above $1.50 CPC — CPCs are too high against entrenched competitors (Wonderbly, Hooray Heroes, IseeMe). Win on SEO instead.
- Reddit / X — kid-gift purchases don't index here in v1.

---

## Pivot signals

Pivot **audience**, not creative, when:

- **ROAS < 1.5 after $1,000 spent on an audience** — kill that audience, reallocate to the next.
- **High click-through, low purchase** — likely a landing-page or pricing problem (audit `/create` form completion rate). Don't blame audience yet.
- **High purchase, low repeat** — that's fine for gifting; gifting is one-shot. Don't over-index on LTV models that assume subscription churn.

**Don't pivot** when:

- ROAS dips in week 2 of a Q4 ramp — Q4 CPMs spike across the entire ecosystem. Hold the audience, lower the daily budget.

---

## Where this lives in code + config

- Meta audience definitions: `scripts/meta-create-lookalike.ts` + `scripts/meta-list-audiences.ts` (template scripts, repurposed)
- Pixel + CAPI events: `lib/meta-capi.ts` (fires `ViewContent`, `InitiateCheckout`, `Purchase`)
- TikTok events: extend `lib/meta-capi.ts` or add `lib/tiktok-events.ts`
- Spend caps: env `META_DAILY_BUDGET_CENTS`, `TIKTOK_DAILY_BUDGET_CENTS`

---

## Anti-ICP — audiences StoryPop should NOT target

- **Kids directly** — COPPA + ethics. Block via Meta's `Audiences > Exclusions` (Under 18 must be excluded).
- **"Crafts / DIY parents"** who would rather make the book themselves. Not the buyer.
- **"Educational toys" cold leads** — too broad, wastes CPM on parents looking for screens-and-flashcards.
- **People in markets we can't ship to** (Meta's auto-placement sometimes adds these — exclude via campaign-level country list).
