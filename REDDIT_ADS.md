# Reddit Ads — paid-acquisition runbook

Reddit has ~1/10th of Meta's reach but the audience self-segregates into perfect-fit subreddits. CPMs are higher than Meta but conversion rates are often **3–5×** because intent is so high. For any merchant whose ICP self-identifies in subreddit names (`r/<vertical>`), Reddit is worth running in parallel with Meta from day 1.

This runbook codifies what worked for the reference [Sitebeat](https://github.com/Zilla-HQ/sitebeat) merchant. The patterns generalize.

---

## When to run Reddit Ads

- **Run if**: your ICP has a dedicated subreddit (r/restaurateur, r/HVAC, r/realestate, r/SaaS, r/SEO, r/webdev). The whole sub is your audience.
- **Skip if**: your ICP is a demographic without a community (general SMB owners scattered across verticals, mainstream consumers).

Meta is better for demographic / interest targeting. Reddit is better for community targeting. Most merchants want both.

---

## Account setup (~10 min)

1. Visit <https://ads.reddit.com>. Sign up (use the merchant's brand inbox).
2. **Verify business** — adds a small banner; not strictly required but lowers cost-per-click.
3. **Add a credit card.** Set the daily-spend cap to **$25/day** while learning. Reddit's billing will charge as you spend.
4. **Reddit Pixel** — Conversions → Create Pixel → name it after your merchant. Copy the Pixel ID + the Conversion API access token.

### Wire the Pixel

The merchant template already wires Meta Pixel via `components/marketing/meta-pixel.tsx`. Add the Reddit equivalent:

```bash
# Vercel env (production + preview)
NEXT_PUBLIC_REDDIT_PIXEL_ID=t2_xxxxxxxx
REDDIT_CONVERSIONS_TOKEN=...   # for server-side Conversions API
```

Then in `app/layout.tsx` (or a `components/marketing/reddit-pixel.tsx` component you create alongside `meta-pixel.tsx`), inject the Reddit advertiser pixel script when `NEXT_PUBLIC_REDDIT_PIXEL_ID` is set. The pattern mirrors the existing Meta one — copy the Meta component, swap the script URL to `https://www.redditstatic.com/ads/pixel.js`, swap event names (`PageView`, `Lead`, `Purchase`).

For server-side events (mirroring Meta Conversions API), POST to `https://ads-api.reddit.com/api/v2.0/conversions/events/<pixel_id>` from the Stripe webhook. Sitebeat fires `Lead` on audit-form submission and `Purchase` on `checkout.session.completed`. Both events match Meta's so the same `lib/meta-capi.ts` shape applies — just a different endpoint + auth header.

---

## Campaign #1 — Subreddit-targeted lead-gen (start here)

| | |
|---|---|
| **Objective** | Conversions, targeting your `Lead` event (the merchant's main funnel entry — audit submission / signup / preview generation). Reddit needs ~50 conversions before its optimization kicks in; expect Week 1 to be exploration. |
| **Bid strategy** | Maximize Conversions. |
| **Daily budget** | $15 to start. |
| **Targeting** | "Communities" — list the subreddits relevant to your ICP. You can add up to 200. **Don't add broad ones** like r/funny or r/AskReddit — they tank CTR. |
| **Placements** | Feed only. Reddit's "conversation placements" (in-comment-thread ads) underperform for most merchants. |
| **Geography** | USA only initially. Reddit's non-US inventory is thinner and CPMs are lower because conversion is lower. |
| **Ad format** | **Image post or text post.** Skip video — Reddit's video CTR is consistently worse than image's. |

---

## Subreddit-targeting list (build per merchant)

For each vertical, list 5–15 subreddits. Sitebeat's working list:

**Local-SMB merchants** (Sitebeat, Relist, plumber-themed tools):
- r/smallbusiness · r/Entrepreneur · r/EntrepreneurRideAlong
- r/restaurateur · r/restaurantowners · r/HVAC · r/Plumbing
- r/Construction · r/Roofing · r/Landscaping

**Indie SaaS / dev merchants**:
- r/SaaS · r/indiehackers · r/SideProject · r/webdev
- r/ProductManagement · r/Entrepreneur

**Marketing / SEO direct ICP**:
- r/Marketing · r/SEO · r/SEO_tools · r/bigseo

Aim for 20–30 subs total in a single Reddit ad set. Going wider dilutes optimization; narrower starves the algorithm.

---

## Ad creative — Reddit-specific rules

Reddit users have the strongest "this is an ad, scroll" reflex of any major platform. Counterintuitive but proven:

1. **Native style wins.** Make the ad look like a Reddit post. Avoid stock photography; avoid heavy branding.
2. **Headline as a question or specific claim.** "Most restaurant websites score below 70/100 on basic SEO. What's yours?" outperforms "Get a free SEO audit."
3. **Image as a clean screenshot of an artifact**: the merchant's actual report / preview / dashboard. **Not** a polished marketing image.
4. **CTA button**: "Try Now" or "Learn More". Avoid "Get Started" (low CTR on Reddit).
5. **Disable comments at first.** Reddit ad comment threads can be brutal. Once you have 5+ paying customers / public-facing case studies, re-enable for social proof.

The merchant template ships `/og-ad` (`app/og-ad/route.tsx`) — an Edge route that generates square (1080×1080) and vertical (1080×1920) ad creatives at request time. Right-click → Save image, upload to Reddit Ads Manager. See [AD_CREATIVES.md](./AD_CREATIVES.md).

---

## Promoted-post strategy (advanced — week 2+)

Stronger CPL than direct ads, but riskier. Workflow:

1. **Post organically** in r/smallbusiness or r/SaaS (or your vertical sub): "I built a free tool that does X. Here's what it found on my own site → [screenshot]. Free if you want to try it: <merchant-url>"
2. **Wait 3–7 days** for organic traction (or fall flat — most do).
3. **If the post sticks**, promote it via Reddit Ads → "Promote Existing Post."

Higher upside than direct ads but requires:
- Authentic karma on the posting account (100+ comment karma in target subs).
- A genuinely non-shilly post — Reddit users smell intent quickly.

**Don't try this from a brand-new account** — moderators auto-remove new-account self-promotion across most major subs.

---

## KPI targets vs. Meta

| Metric | Reddit target | Meta target | Notes |
|---|---|---|---|
| **CPL** (cost per lead) | $5–10 | $2–5 | Reddit is more expensive per click. |
| **Conversion rate** (lead → paid) | 8–15% | 2–5% | Reddit's audience is already category-aware. |
| **Net CPS** (cost per paid sub) | similar to Meta | — | Reddit's higher CPL offsets by higher conversion. |
| **CTR** | > 0.8% | > 1.5% | Reddit CTRs are structurally lower; don't panic-pause anything above 0.5%. |

If CPS holds under your target after 2 weeks of $15/day, scale to $50/day. Don't 2× faster than that — Reddit's algorithm re-enters learning phase on big budget jumps.

---

## Pre-flight checklist

- [ ] Reddit Ads account created
- [ ] Business verified
- [ ] Reddit Pixel installed on every public page (via component matching `components/marketing/meta-pixel.tsx`)
- [ ] Server-side Conversions API event firing from Stripe webhook
- [ ] Daily spend cap set ($25/day)
- [ ] Subreddit list assembled (20–30 entries)
- [ ] 3 ad creatives generated (use `/og-ad?v=hook|fix|weekly` — see [AD_CREATIVES.md](./AD_CREATIVES.md))
- [ ] Comments disabled on initial ads
- [ ] `Lead` + `Purchase` events confirmed firing in the Reddit Conversions dashboard

---

## Recommended day-1 split (Meta + Reddit)

| Channel | Daily budget | Why |
|---|---|---|
| Meta | $25 | Volume + algorithmic learning. 3 ICP ad sets, 3 creatives each. |
| Reddit | $15 | High-intent. Direct subreddit targeting. |
| **Total** | **$40/day** | $1,200/mo conservative learning budget. Scale to $200/day once CPS holds under target. |

After 2 weeks of data, kill whichever channel is worse on CPS — don't try to run both forever just because they both work.

---

## Reference

See Sitebeat's full paid-acquisition playbook at [`docs/PAID_ACQUISITION.md`](https://github.com/Zilla-HQ/sitebeat/blob/main/docs/PAID_ACQUISITION.md) for the Meta + Reddit copy library + ICP-specific targeting recipes.
