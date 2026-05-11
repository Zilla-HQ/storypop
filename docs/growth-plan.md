# StoryPop growth plan

StoryPop is a B2C autonomous merchant that makes personalized illustrated children's books. Parents (and grandparents/gifters) fill out a 4-field form; in 5–8 minutes, the site generates a 12–16 page custom story with the kid as the protagonist; the first 3 pages are shown free, then PDF/softcover/hardcover/bundle SKUs gate the rest. This doc consolidates audience, persona, founding thesis, and launch phases.

Live at [storypop.shop](https://storypop.shop). Samples at [storypop.shop/samples](https://storypop.shop/samples).

---

## Thesis

Three things shifted in 2024–2026 that collapsed the unit economics of personalized kids' books from $150–$500 (Wonderbly, Hooray Heroes) down to under $5 marginal cost:

1. **Character lock-in works.** Flux LoRAs trained on a 3-shot of the kid's photo lock the character's features across 16 illustrations cheaply (~$0.18 per book). Two years ago, you needed manual artist consistency.
2. **Picture-book-quality illustration is one-shot.** Nano Banana Pro + style-preamble produces consistent picture-book pages without hand re-rendering.
3. **Print-on-demand has accessible APIs.** Lulu xPress submits a single book at a time with no minimums. Two years ago this required 100+ books per print run.

StoryPop is the second merchant on `Zilla-HQ/merchant-template` (after Relist). The biggest patterns it contributes upstream: print-fulfillment provider interface (Lulu, mirroring the template's staging-API swappability), image-safety gate with retry-on-flag, photo-retention auto-purge.

---

## Unit economics

| SKU | Price | Marginal cost | Gross margin |
|---|---|---|---|
| Instant PDF | $14.99 | ~$1.04 (gen) | ~$13.95 |
| Softcover | $29.99 | ~$1.04 + ~$5.50 (Lulu) | ~$23.45 |
| Hardcover | $44.99 | ~$1.04 + ~$10.50 (Lulu) | ~$33.45 |
| Gift bundle | $69.99 | ~$1.04 + $10.50 + ~$14 (Printful plush) | ~$44.45 |

Blended AOV target: $35. Blended gross margin target: $27 (~77%).

Per-book marginal-cost breakdown: ~$0.18 LoRA training + ~$0.04 × 16 pages image-gen + ~$0.02 story = **~$1.04 per generated preview**. Set `PREVIEW_DAILY_BUDGET_CENTS=10000` to cap $100/day spec — fal.ai bills can spiral on viral days.

At $7 blended CAC: contribution margin is ~$20/book. Comfortable. Q4 CPMs spike 50–80% and will push CAC up; absorb with the seasonal volume.

---

## Audience targeting — paid ads, not cold outreach

StoryPop is paid-ads-driven B2C. The merchant-template's ICP framework was built around cold outreach; the analogous discipline here is **Meta + TikTok audience targeting**.

| Filter | Mom-buyer (self) | Grandparent gifter | Aunt/uncle gifter | Baby-shower buyer |
|---|---|---|---|---|
| Price tolerance | $14.99–44.99 OK | $29.99–69.99 (hardcover + bundle) | $29.99–69.99 | $44.99–69.99 |
| Decision authority | Self | Self | Self | Self |
| Motivation window | Bedtime, birthday, big-moment | Birthday, Christmas, "I miss them" | Birthday, "good aunt energy" | Baby shower |
| Channel fit | Meta Reels, TikTok | Meta feed + carousel | Meta Reels + Pinterest | Meta + Pinterest |
| **Verdict** | **Primary — scale first** | **Highest-AOV — scale second** | **Volume Q4 + birthday-month** | **Niche evergreen, run small** |

### Targeting strategy v1

**Meta (primary, ~80% of spend):**
1. Lookalike off purchasers (after first 50 sales).
2. Interest stack: "Mom blog" + "Picture book authors" + "Etsy gifting" + "Personalized gifts".
3. Reels auto-placement, $50/day cap.
4. Q4 gift-seasonality lookalike, activated mid-October.

**TikTok (~15%):** Auto-targeting; demo-style videos (page turns, character matching the photo). **No UGC** — founder won't record.

**Pinterest (~5% test):** Gift-board placements. Single hardcover-bundle campaign at $25/day for 30 days.

**Don't run:**
- Google Search above $1.50 CPC — CPCs are too high against entrenched competitors (Wonderbly, Hooray Heroes, IseeMe). Win on SEO, not paid search.
- Reddit / X — kid-gift purchases don't index here.

### Anti-targeting (hard exclusions)

- **Kids under 18** — COPPA + ethics. Excluded at Meta campaign level.
- **"Crafts / DIY parents"** — wants to make the book themselves, not buy it.
- **"Educational toys" broad** — diffuse, wastes CPM.
- **Markets we can't ship to** — Meta's auto-placement sometimes adds these; exclude via campaign country list.

### Pivot signals

- **ROAS <1.5 after $1,000 on an audience** — kill that audience.
- **High CTR, low purchase** — likely landing-page or pricing problem; audit `/create` form completion rate before blaming audience.
- **High purchase, low repeat** — fine. Gifting is one-shot; don't over-index on LTV models that assume subscription churn.

---

## Persona — Pip

The named agent who narrates StoryPop to the public.

**Name**: Pip.
**Reference voice**: (a) a children's librarian who's read every picture book in the section, (b) a studio illustrator's notebook voice. The test for any sentence: "Would a librarian who illustrates on weekends say it?"

**Hard rules**:
- First-person singular always. "I drew Lily standing on the moon" — not "we drew."
- Specific over cute. "Lily, age 5, dragon under the bed" beats "your little one's bedtime adventure."
- Use the kid's name when known — not "your child."
- No emoji unless the parent used one first.
- Doesn't apologize for being AI. Doesn't oversell being AI either.
- When something goes wrong (misspelled name, weird hand), owns it plainly and fixes it.

```bash
AGENT_NAME=Pip
AGENT_TAGLINE="A book where your kid is the hero."
AGENT_VOICE_NOTES="Children's librarian + illustrator's notebook. First-person singular. Specific over cute. Use the kid's name when known. No emoji unless parent used one first. Owns mistakes plainly."
```

Write Pip's first 3 diary entries by hand. Suggested seeds:
1. The first book that worked — a real preview for an actual kid, what the parent wrote back, the page Pip thinks is the best.
2. The page Pip redid — wrong hair color, weird hand, how Pip fixed it. Models the "owns mistakes" rule.
3. The bedtime archetype — why bedtime stories are 14 pages not 16, and why every one ends with the kid asleep.

After these three, future entries are LLM-drafted using them as examples.

---

## Launch phases

### Phase 0 — pre-launch (3–4 weeks)

1. Ship `storypop.shop` with all 6 sample books visible at `/samples`. No ads until samples are live.
2. Generate 50 hand-curated sample previews for staff/friends/real kids. Calibrate the bar — what's "good enough to ship"?
3. Pixel + CAPI fire correctly. Test via Meta's Event Manager Test Events.
4. Stripe Tax configured.
5. **One real Lulu hardcover ordered and physically delivered.** Photograph it on arrival. Don't ramp ads until this is verified.
6. Write Pip's first 3 diary entries.
7. Pre-flight 15 creatives (5 video + 5 carousel + 5 static) for Meta. No UGC.

### Phase 1 — paid traffic, calibrate (weeks 1–4)

Goal: **100 purchases.**

- Meta $100/day → scale to $300/day by week 3 if ROAS >1.5. 3 ad sets (lookalike-stub broad, interest-stack, Reels auto-placement). 5 creatives each, rotate weekly on CTR.
- TikTok $25/day, mostly auto-targeting. 5 demo-style videos.
- Friends + family soft launch — 100 personal DMs week 1. `LAUNCH50` code (50% off, 100-redemption cap).

Week-4 targets: 100 purchases, blended ROAS >1.5, preview-to-purchase >8%, refund rate <3%, AOV >$25. ROAS <1.0 at week 2 → pause spend. Fix is creative, not budget.

### Phase 2 — scale + SEO compounding (weeks 5–12)

If Phase 1 hits: scale to $1K/day blended. Add Pinterest at $25/day as a Q4-prep test.

New surfaces:
- `/for/[occasion]` programmatic SEO pages — 60–80 long-tail pages.
- `/samples/[archetype]` deep gallery pages.
- 30-day post-purchase retention email — "what's next" (sibling book? birthday next year?).
- First Pip-voiced longform — "how the first 100 books got made," ~1,500 words.

Exit: 500 books shipped, ROAS >2.0, lookalike from 100+ purchasers, first organic SEO traffic (>500 visitors/mo).

### Phase 3 — Q4 ramp (mid-Oct to mid-Dec)

Q4 is the year. Plan from week 30:
- Hold creative pipeline open from August. Q4 needs 30+ fresh creatives.
- Pre-warm Black Friday audience starting October.
- Scale spend 3–5×. Daily caps: $5K Meta + $1K TikTok by Nov 15. ROAS dips 2.0 → 1.3–1.7. Acceptable for volume.
- Confirm Lulu Q4 capacity. Printful as backup for hardcover.
- "Order by Dec 15 for Christmas delivery" cutoff hardcoded in `lib/lulu.ts:shippingCutoff`.

Don't during Q4: no site redesigns, no new SKU launches, no major creative direction change.

---

## Risks

1. **Character mismatch refunds.** Target <2%. Mitigation: retry-on-flag in `lib/falai.ts`, explicit "doesn't look like my kid" refund button.
2. **Content safety slips.** Hardcoded deny list in `lib/falai.ts:SAFETY_PREAMBLE` (no branded characters, no violence). Operator reviews first 100 books and any flagged prompts.
3. **COPPA + kid-photo handling.** Buyer is always the parent. Photos auto-purge 30 days. Enforced by `inngest/functions/photo-purge.ts`. Audited monthly.
4. **Meta ad-account suspension.** Account under Zilla BM `1952475115474490` to inherit BM trust. Never use real customer photos in ads — use stock illustrations + StoryPop samples. Pre-flight every creative through Meta's policy linter.
5. **Lulu print delays during Q4.** Email proactively if shipping crosses stated lead time. Offer PDF-credit refund for late prints.
6. **Race / ethnicity rendering default.** Base model skews white/Western. The form asks skin/hair color when no photo provided. Document the design choice publicly so we own it.

---

## What StoryPop does NOT do

- **No cold outreach.** B2C — there's no list to cold email. The merchant-template's discovery layer is deleted in this fork.
- **No Product Hunt as sales channel.** Fine for "we built this" moment; doesn't convert kid-gift buyers.
- **No UGC creator program.** Founder won't record. Possibly Phase 3 if a parent organically posts and we amplify.
- **No influencer marketing in v1.** Too expensive vs paid ads.
- **No B2B partnerships with schools / daycares in v1.** Tempting but sinks margin and distracts.

**The single non-negotiable: the buyer is always the parent, never the kid.** Every channel choice respects this.

---

## Acquisition stack inherited from the template

- `@vercel/analytics` in `app/layout.tsx`
- PostHog server-side via `lib/posthog.ts:trackEvent()` — fires on `book-request/created`, `preview/ready`, `order/paid`
- Meta Pixel + CAPI via `lib/meta-capi.ts` — `ViewContent`, `InitiateCheckout`, `Purchase`
- UTM capture via `lib/attribution.ts` (rename cookie to `storypop_attr`)
- Schema: `books.utm_*` + `books.referrer`

---

## Open decisions (resolve in first 90 days)

1. **Free-tier pages: 3 vs 4 vs 5.** More free pages → higher landing conversion + more free-gen cost. Default 3; A/B test 4 in week 6.
2. **TikTok organic cadence.** No UGC. Test 3 stock-illustration / screen-recording posts/week for 4 weeks.
3. **Gift-bundle SKU activation.** Plush via Printful adds ops complexity. Launch with PDF + softcover + hardcover; add bundle in week 8 only if AOV trends justify.
4. **Subscription / book club tier.** "One book a quarter for $39." Don't build until 1,000 single-purchase customers prove the LTV math.
5. **International shipping.** Lulu prints in EU + AU. Add after US passes 500 books/mo.
