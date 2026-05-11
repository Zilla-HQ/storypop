# StoryPop — founding memo

## What StoryPop is

StoryPop is an autonomous merchant that creates personalized illustrated children's books. Parent fills out a 4-field form ("Lily, age 5, she/her, bedtime archetype") and optionally uploads a photo of their kid. Within 5–8 minutes, StoryPop generates a 12–16 page custom story with that kid as the protagonist, illustrated end-to-end. Three pages are shown free in the preview; the rest gates behind a Stripe checkout. SKUs: instant PDF ($14.99), softcover ($29.99), hardcover ($44.99), gift bundle with plush ($69.99). Printed books fulfill through Lulu xPress.

## Why now

Three things changed in the last 12 months that didn't exist before:

1. **Character lock-in works.** Flux LoRAs trained on a 3-shot of the kid's photo lock the character's features across 16 illustrations cheaply (~$0.18 per book). Two years ago, you needed manual artist consistency. Now it's an API call.
2. **Picture-book-quality illustration is one-shot.** Nano Banana Pro + style-preamble produces page-quality picture-book illustrations that don't need hand re-rendering. Two years ago, every page needed an illustrator.
3. **Print-on-demand has accessible APIs.** Lulu xPress submits a single book at a time programmatically with no minimums. Two years ago, you'd need 100+ books printed per run.

These three together collapse a workflow that was unit-priced at $150–$500 per book (Wonderbly, Hooray Heroes) down to a marginal cost under $5 for the PDF tier.

## Who StoryPop is for

**Gifters.** Specifically:
- Parents buying for their own kid for birthdays, holidays, big-moment occasions (first day of school, new sibling, lost tooth).
- Grandparents buying for grandkids. (Highest AOV — skews hardcover + bundle.)
- Aunts/uncles buying around birthdays.
- Baby-shower invitees needing a not-cheap-but-not-cheesy gift.

Not for: educators, classroom kits, libraries. Those are B2B and not v1.

See [ICP_FRAMEWORK.md](ICP_FRAMEWORK.md) for the full audience targeting.

## Why StoryPop wins

1. **Speed.** 5–8 minutes from form to preview. Wonderbly takes 24 hours. The gifting moment is impulsive — the buyer wants to see the result before deciding.
2. **Free preview.** 3 pages free. The buyer doesn't pay until they see the kid rendered well. This converts dramatically better than "trust us, you'll like it."
3. **Marginal cost.** ~$1.04 per generated preview. Wonderbly's wholesale cost per book is closer to $15. StoryPop can spend more on Meta ads per acquisition because the back-end economics are 10× better.
4. **Print-on-demand without inventory.** Lulu prints book-by-book. Zero inventory risk, zero warehousing. The unit economics scale linearly without working-capital pressure.
5. **Brand voice through Pip.** A named maker persona (see [PERSONA.md](PERSONA.md)) makes the gift feel hand-made even though production is automated.

## How StoryPop makes money

| SKU | Price | Marginal cost | Gross margin |
|---|---|---|---|
| Instant PDF | $14.99 | ~$1.04 (gen) | ~$13.95 |
| Softcover | $29.99 | ~$1.04 + ~$5.50 (Lulu print + ship) = $6.54 | ~$23.45 |
| Hardcover | $44.99 | ~$1.04 + ~$10.50 (Lulu print + ship) = $11.54 | ~$33.45 |
| Gift bundle | $69.99 | ~$1.04 + $10.50 + ~$14 (Printful plush + ship) = $25.54 | ~$44.45 |

Blended AOV target: $35. Blended gross margin target: $27 (~77%).

Stripe + Meta CPMs: at $7 blended CAC, contribution margin is ~$20/book. Comfortable.

## Targets

- **Day 30**: 50 books shipped, primarily off Meta cold traffic. $1,750 revenue.
- **Day 90**: 500 books shipped. $17,500 revenue. ROAS at 2.0+. First viral TikTok demo. Lookalike audience based on the first 100 purchasers.
- **Day 180**: 2,000 books shipped. $70,000 revenue. Lulu account graduated to bulk pricing; Q4 ramp begins.
- **Q4 (Oct–Dec)**: 8,000 books shipped Q4 alone. $280,000 Q4 revenue. Holiday/birthday demand is 4× a normal month.
- **Day 365**: 15,000 books cumulative. $525,000 revenue. ~3% AOV bundle attach rate. 5–7% repeat purchase rate (mostly siblings of original kid).

These are targets. The unknowns: viral TikTok coefficient (could be huge or zero), Q4 CPM survival (Meta CPMs spike 50–80% mid-November), and refund rate on character-mismatch (target <2% — every additional point costs ~$1.50 per book).

## Risks

1. **Character mismatch refunds.** The photo-to-LoRA pipeline sometimes drifts (wrong hair, off ethnicity). Target: <2% refund rate. Mitigation: retry-on-flag in `lib/falai.ts`, and an explicit "the character doesn't look like my kid" refund auto-trigger.
2. **Content safety failures.** If a parent's archetype request slips a brand character (Disney, Marvel, etc.) past the safety gate, we ship a potentially-infringing book. Mitigation: hardcoded deny list in `lib/claude.ts:storySafetyGate`, plus the fal.ai NSFW filter, plus operator review for first 100 books and any flagged prompts.
3. **COPPA and kid-photo handling.** The buyer is the parent; we never sell to kids; photos auto-purge in 30 days. Mitigation: documented in privacy policy, enforced by `inngest/functions/photo-purge.ts`, audited monthly.
4. **Meta ad-account suspension.** Kid-focused creative + photo-of-children-in-ads sometimes triggers Meta's automated reviewers. Mitigation: never use real customer photos in ads; use stock illustrations + the StoryPop sample books. Pre-flight every creative through Meta's policy linter. Account lives under Zilla BM `1952475115474490` so it inherits BM trust.
5. **Lulu print failures or shipping delays.** Q4 is brutal for print partners. Mitigation: 7–10 day stated lead times with buffer; auto-email customer if shipping crosses day 10.
6. **Race / ethnicity rendering.** Default characters in fal.ai's base model skew white/Western. Without the LoRA character-lock, books for non-white kids without uploaded photos can render poorly. Mitigation: the form ask for skin/hair color when no photo provided. Document this design choice in the public diary so we own the choice, not stumble into it.

## What StoryPop is not

- **Not a publishing platform.** Parents don't get to author their own stories; the AI writes them, gated to age-appropriate archetypes.
- **Not a classroom tool.** No bulk pricing, no teacher discounts. B2C only.
- **Not licensable IP.** We don't license existing characters (Disney, Marvel, Bluey, etc.) and we never will. Hardcoded refusal.
- **Not a print shop.** Lulu does the printing; we don't try to scale a fulfillment center.

## How this fits inside Zilla

StoryPop is the **second merchant** built on `Zilla-HQ/merchant-template` (after Relist). The platform-level work — auth, payments, scheduling, compliance, admin, the preview-checkout flow — is inherited. The biggest deltas StoryPop introduces:

- A non-scraping discovery model (B2C, paid ads).
- A print-fulfillment provider interface (Lulu → mirroring the staging-API swappability pattern in the template).
- A photo-retention + auto-purge cron (other gen-image merchants will need this).

StoryPop shares Zilla's Meta Business Manager (`1952475115474490`). The ad account is provisioned by Zilla; StoryPop reimburses spend per the Option-A billing model. See [ZILLA_HQ_SETUP_META.md](ZILLA_HQ_SETUP_META.md).

## Open decisions

These get answered in the first 90 days:

1. **Free-tier pages: 3 vs 4 vs 5.** More free pages = higher landing-page conversion, more free generation cost. Three is the default; A/B test 4 in week 6.
2. **TikTok organic content cadence.** No UGC (founder won't record). Stock-illustration demos + screen recordings of the create-flow + AI-narrated samples. Test 3 posts/week for 4 weeks. (See [AD_CREATIVES.md](AD_CREATIVES.md).)
3. **Gift-bundle SKU activation.** Plush sourcing through Printful adds operational complexity. Launch with PDF/softcover/hardcover; add bundle in week 8 only if AOV trends justify it.
4. **Subscription / book club tier.** A potential "one book a quarter for $39" subscription tier. Don't build it until 1,000 single-purchase customers prove the LTV math.
5. **International shipping.** Lulu prints in EU + AU. Worth adding once US monthly volume passes 500 books to avoid pre-mature ops complexity.
