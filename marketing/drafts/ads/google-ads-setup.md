# Google Search Ads — one-click import

## Why this beats Meta for first revenue

Google Search captures **expressed intent** ("virtual staging service",
"boxbrownie alternative") — those people are ready to buy *right now*.
Meta captures latent interest, much weaker.

Typical conversion rates on this kind of bottom-funnel search traffic:
- Google Search Ads: 3–8%
- Meta cold targeting: 0.5–2%
- Meta retargeting: 3–10% (do this too — see meta-retargeting-setup.md)

A $20/day Google Search ad set should yield 1–3 paid orders/week
once the watermark fix is in (which we just shipped).

---

## How to import the CSV (5 minutes)

1. Download Google Ads Editor from `https://ads.google.com/intl/en/home/tools/ads-editor/`
2. Open Editor, sign into your Google Ads account (the one that owns the
   conversion tracking pixel).
3. **Account → Import → From file** → select `marketing/drafts/ads/google-ads-import.csv`
4. Editor will preview 14 keywords across 4 ad groups. Click "Import all".
5. Sanity-check the campaigns:
   - Realscale - Virtual Staging Core ($30/day)
   - Realscale - Photo Enhancement ($20/day)
   - Realscale - Twilight Conversion ($15/day)
   - Realscale - Competitor Conquest ($15/day)
6. **Add negative keywords** (drop these into all four campaigns):
   ```
   -furniture -decor -interior -designer -decorator
   -game -movie -book -tv -show -netflix
   -job -jobs -career -salary -hire -hiring
   -tutorial -free -download -cracked -pirated
   -course -training -class -learn -learning
   -app -application -student -students
   -stage -stages -theater -theatre
   ```
7. Click **Post** to push the campaigns live.

Total daily budget: **$80/day** to start. Pause / scale based on
CAC after 7 days.

---

## Conversion tracking

Google Ads needs to know when a paid order happens to optimize on
"Maximize Conversions" bidding. Set up conversion tracking:

1. Google Ads → Tools → Conversions → New conversion action → Website
2. **Goal:** Purchase
3. **Tag setup:** "Use Google tag manager" or "Add gtag manually"
4. Conversion event: "purchase" (already firing on the Stripe webhook
   via Meta CAPI; we'd need to add a parallel gtag for Google)

If you don't want to add gtag immediately, use **Maximize Clicks**
bidding instead of Maximize Conversions for the first week — get
volume + click data, then switch to Maximize Conversions once you
have 3–5 conversion events tracked.

---

## City-modified expansion (week 2)

After 7 days of "core" terms running, layer in city-specific terms.
Editor → bulk add keywords:

```
"virtual staging phoenix"  | bid: $2.50 | URL: https://realscale.app/virtual-staging/phoenix-az
"virtual staging miami"    | bid: $2.50 | URL: https://realscale.app/virtual-staging/miami-fl
"virtual staging dallas"   | bid: $2.50 | URL: https://realscale.app/virtual-staging/dallas-tx
"virtual staging austin"   | bid: $2.50 | URL: https://realscale.app/virtual-staging/austin-tx
"virtual staging houston"  | bid: $2.50 | URL: https://realscale.app/virtual-staging/houston-tx
"virtual staging atlanta"  | bid: $2.50 | URL: https://realscale.app/virtual-staging/atlanta-ga
"virtual staging chicago"  | bid: $2.50 | URL: https://realscale.app/virtual-staging/chicago-il
"virtual staging denver"   | bid: $2.50 | URL: https://realscale.app/virtual-staging/denver-co
"virtual staging seattle"  | bid: $2.50 | URL: https://realscale.app/virtual-staging/seattle-wa
"virtual staging los angeles" | bid: $3.00 | URL: https://realscale.app/virtual-staging/los-angeles-ca
"twilight photos austin"   | bid: $2.00 | URL: https://realscale.app/twilight-photos/austin-tx
"twilight photos miami"    | bid: $2.00 | URL: https://realscale.app/twilight-photos/miami-fl
```

Each city-modified term routes to its city-specific landing page,
which Google's Quality Score rewards (URL ↔ keyword relevance is
1/4 of Quality Score). Your CPC will drop ~30% on these vs generic
"virtual staging" terms.
