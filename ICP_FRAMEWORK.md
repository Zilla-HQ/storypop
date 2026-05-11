# ICP framework — picking (and pivoting) cold-outreach targeting

The single most expensive mistake in cold-outreach is targeting the wrong ICP. A 0% conversion rate over 50–100 sends isn't a copy problem — it's an ICP problem. This doc is the framework for choosing the initial ICP and pivoting when the data says you got it wrong.

Patterns from the reference [Sitebeat](https://github.com/Zilla-HQ/sitebeat) merchant, which **pivoted ICPs after the first 92-email batch hit 0% paid conversion**. The lesson generalizes.

---

## The four ICP filters

A vertical earns cold-outreach budget only if it passes all four:

### 1. Pricing tolerance

Can the average business in this vertical afford the merchant's monthly fee without internal approval?

- **At $29/mo**: any business owner can sign personally. Owner-led SMBs in profitable verticals pass.
- **At $99/mo**: usually still owner-led, but margin-sensitive verticals (restaurants, low-end retail) start saying no.
- **At $299+/mo**: needs a budget owner who isn't the founder. Don't cold-email; you need a sales motion.

### 2. Marketing self-determination

Does the prospect set their own marketing budget, or does corporate / a franchise / an agency?

- **Self-determined**: 1-person professional services (lawyers, accountants, real-estate agents, designers, consultants), indie SaaS founders, agency owners, premium-trade contractors. **Yes.**
- **Corporate-determined**: chain restaurants, franchisees, retail outlets of national brands. **No** — your email goes to a generic info@ that gets ignored.
- **Agency-determined**: many SMBs delegate marketing entirely. **Maybe** — depends whether your offer beats what the agency does (in which case, recruit the agency directly; see PARTNERS.md).

### 3. Pain visibility

Does the prospect feel the pain your merchant solves directly and immediately, or is it abstract / delayed?

- **Direct**: drop in inbound leads = drop in revenue = visible this month. Examples: lawyers tracking referral source, agencies whose clients fire them when traffic drops, indie SaaS founders watching their funnel daily.
- **Abstract**: "good SEO is important" — true but not painful enough to trigger a $29 purchase from a cold email.

Verticals where pain is *abstract* (most restaurants, salons, low-end retail) require either (a) much warmer outreach, or (b) a different hook.

### 4. Communication channel fit

Does this vertical actually check email at a rate that justifies cold outreach?

- **Email-native**: SaaS founders, agencies, accountants, lawyers, consultants. Check email 3–10× / day.
- **Email-occasional**: restaurants, salons, small retailers. Owner is on the floor, not at a laptop. Email is the worst channel; SMS / Instagram DM might work but TCPA-gated.
- **Email-dead**: blue-collar trades that ran the same business for 20 years. Phone calls are the only path.

If a vertical fails #4, the rest doesn't matter.

---

## What Sitebeat learned

Sitebeat's first cold batch (92 emails) targeted restaurants + salons + fitness studios + hospitality + low-margin trade services. **Zero paid conversions.**

Reasons:

- Restaurants care about **Google Maps + Instagram**, not the kind of regression alerts Sitebeat sends. SEO pain is abstract for them.
- Salons are owner-on-the-floor businesses. The owner doesn't open laptop email mid-shift.
- Low-margin trades (cleaning, basic plumbing) have $29/mo budget tolerance but don't perceive SEO pain — phone-call inbound is most of their volume.

The pivot, May 2026: replaced the entire vertical list with **30 higher-margin verticals** where all four filters pass:

```
# lib/discover/yelp-terms.ts (Sitebeat) — DEFAULT_YELP_TERMS
# Marketing / web professionals — they get SEO, often pay, often refer clients
- marketing agency
- web design
- digital marketing agency
- seo consultant
- branding agency
- graphic designer
# Accounting / financial — high $29/mo tolerance, paid websites
- accountant
- cpa
- tax preparation
- bookkeeping
- financial advisor
- insurance agency
- wealth management
# Legal — high revenue per case, sensitive to local-SEO regressions
- law firm
- personal injury lawyer
- estate planning attorney
- family law attorney
# Health professionals — small private practices with their own websites
- dentist
- orthodontist
- chiropractor
- physical therapy
- veterinarian
- dermatologist
- med spa
- optometrist
# Real estate professionals — own marketing budget, paid websites
- real estate agent
- real estate broker
- mortgage broker
- home inspector
# Premium trades / specialty contractors (high-margin, not low-end)
- interior designer
- architect
- general contractor
- kitchen remodeling
- bathroom remodeling
- custom home builder
# 1:1 service professionals with paid websites
- business coach
- executive coach
- personal trainer
- wedding photographer
- commercial photographer
```

All 30 pass all 4 filters: self-determined budget, direct SEO pain, email-native, $29/mo trivial relative to revenue per customer.

---

## Picking your starting ICP

For a new merchant fork, before writing a single line of cold-email copy:

1. **List 5–10 candidate verticals** the merchant's hook plausibly serves.
2. **Run each through the 4 filters above.** Drop anyone failing #1 or #4 immediately — they'll waste outreach budget.
3. **Pick the smallest one that passes all four.** Smaller subs have less competition for cold-email attention. r/HVAC (135K members) converts cold email at 3–5×; r/Entrepreneur (3.6M) at <1%.
4. **Run 30–50 cold sends** to test. Reply rate (not just open rate) is the signal. **Below 3% replies in any vertical = you got the ICP wrong, pivot before sending more.**

---

## Pivot signals

Pivot the ICP when:

- **0–1 paid conversions after 100+ cold sends** — even with perfect copy, no vertical converts below 0.5% over 100 sends. The problem isn't the funnel.
- **High open rate, low reply rate** — your hook resonates but the audience isn't the buyer. The owner reads but doesn't have authority / budget.
- **Replies are universally "what is this?" / "we already do this internally"** — your offer is either confusing or obvious to this vertical. Either way, wrong audience.

**Don't pivot** when:

- Reply rate is 3–8% but no conversions yet. The funnel is leaking elsewhere (email → landing page → checkout). Diagnose the leak before changing ICP.
- A single replier complains. One angry email doesn't override the data.

---

## ICP per merchant pattern (the table)

When you fork the template, fill this in for your merchant before launching cold outreach:

| Filter | Your vertical-1 | Your vertical-2 | Your vertical-3 |
|---|---|---|---|
| Pricing tolerance ($29 / $99 / $299) | | | |
| Marketing self-determination (self / corporate / agency) | | | |
| Pain visibility (direct / abstract) | | | |
| Channel fit (email-native / occasional / dead) | | | |
| **Verdict** | Run / Drop / Test | Run / Drop / Test | Run / Drop / Test |

Three verticals is enough for initial testing. Going wider before you have conversion data dilutes signal.

---

## Where this lives in code

For merchants that use a Yelp-based discovery cron (matches `app/api/cron/discover/route.ts` in Sitebeat or `inngest/functions/discovery.ts` for Apify-based merchants), the ICP list ends up as either:

- **`DEFAULT_YELP_TERMS` array** at the top of the discovery route (Sitebeat pattern — see `app/api/cron/discover/route.ts`)
- **`PRICE_MIN_CENTS` + an Apify actor filter** (Realscale/Relist pattern — see `inngest/functions/discovery.ts`)
- **Env-driven** (`YELP_DISCOVERY_TERMS` / `YELP_DISCOVERY_LOCATIONS`) — recommended for new merchants so you can pivot ICPs without redeploying

The data is the ICP; the discovery code shouldn't hardcode it past the prototype phase.

---

## Reference

Sitebeat's full ICP-pivot postmortem lives in `lib/check-recommendations.ts` comments + the May 2026 commit history in [`Zilla-HQ/sitebeat`](https://github.com/Zilla-HQ/sitebeat).
