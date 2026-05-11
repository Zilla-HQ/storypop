# Meta Retargeting — clickers + warm audiences

Goal: catch the 17+ recipients who already clicked through to the
personalized landing page but didn't convert. These are the hottest
leads we have and Meta retargeting against them converts at 5–10× cold
targeting at 1/3 the CPM.

The Pixel + CAPI pipe is **already wired** (`lib/meta.ts`,
`components/marketing/meta-pixel.tsx`). Events firing:
- `Lead` on `/api/self-serve` URL submit
- `InitiateCheckout` on `/l/<slug>` tier click
- `Purchase` on Stripe checkout success (server-side CAPI)

---

## Step 1 — build a Custom Audience in Ads Manager

Open Ads Manager → Audiences → Create → Custom Audience → Website.

**Audience definition:**
```
Source:    Realscale Pixel ({META_LEAD_CAMPAIGN_ID's pixel})
Include:   People who triggered "InitiateCheckout"
           OR people who triggered "Lead"
Time:      Last 14 days
Exclude:   People who triggered "Purchase" (last 30 days)
Name:      RS Clickers - 14d (no purchase)
```

Save. Audience populates in 30–60 min.

Build a second audience for lookalikes:
```
Source:    Realscale Pixel
Include:   People who triggered "InitiateCheckout"
Time:      Last 90 days
Name:      RS High-Intent Seed
```

Then create LAL: 1% Lookalike of "RS High-Intent Seed", US.

---

## Step 2 — campaign

**Campaign objective:** Conversions (Purchase)

**Ad set 1 — Direct retarget**
- Audience: RS Clickers - 14d (no purchase)
- Budget: $30/day
- Optimization: Purchase
- Placements: Auto (Meta will pick FB Feed + IG Feed + Reels)
- Bid: lowest cost
- Schedule: continuous

**Ad set 2 — LAL of high-intent**
- Audience: 1% LAL of RS High-Intent Seed
- Layered interest: realtor.com OR Zillow OR keller williams OR re/max OR Real estate
- Budget: $30/day
- Optimization: Purchase

**Don't run** the broad cold-targeting Meta campaign (currently $10/day
sales, $75/day leads paused). Until we have purchase events firing
to optimize on, broad targeting is wasted spend.

---

## Step 3 — ad creative (3 variants)

### Variant A: speed flex (3-second video)
- 0–1s: text overlay "Listing posted at 9:14 AM"
- 1–2s: bad/empty MLS photo
- 2–3s: same photo, virtually staged. Text: "Delivered at 10:53 AM"
- Caption: "Virtual staging that arrives the same day you list. $89 per
  listing, NAR-compliant. Free preview — paste your Zillow URL."
- CTA: Get Started → https://realscale.app/agents?code=LAUNCH50

### Variant B: direct comparison (static carousel, 3 cards)
- Card 1: text "BoxBrownie: $32/photo × 12 = $384. 24-48 hour turnaround."
- Card 2: text "Realscale: $89/listing total. <2 hour. NAR-compliant."
- Card 3: real before/after staged photo from `/agents#samples`
- Caption: "Same caliber of edit, ~80% less money, same-day delivery."
- CTA: Compare → https://realscale.app/agents?code=LAUNCH50

### Variant C: data-driven (single static)
- Big headline image: "$11K — average lift on listings priced
  $200K-$1M with pro photos. Source: Redfin (50K+ listings)."
- Caption: "Most agents skip pro photos because they don't have time.
  Realscale gives you 12 staged photos in <2 hours for $89."
- CTA: Try Free Preview → https://realscale.app/agents?code=LAUNCH50

---

## Step 4 — copy variants for headlines + bodies

**Headlines (rotate):**
```
$89/Listing Virtual Staging
Stage 12 Photos in 2 Hours
Beat BoxBrownie on Speed
Free Preview, No Signup
50% Off Today (LAUNCH50)
Paste Any Zillow URL
14-Day Refund Guarantee
```

**Body copy variants:**
```
Type: 1. Direct
Body: Free AI-staged before/after on any Zillow listing. Pay $89 per listing only when you order. <2 hour delivery, NAR-compliant.

Type: 2. Pain-point
Body: Stop paying $32/photo and waiting 48 hours. Realscale stages your whole listing in <2 hours for $89 flat.

Type: 3. Social proof
Body: 50K+ Redfin listings show pro photos correlate with $11K higher sale prices. Realscale gets you there in 2 hours. From $89.
```

---

## Budget ramp plan (only after first organic conversion)

- Week 1: $30 retarget + $30 LAL = $60/day. 7-day check.
- Week 2 (if CAC < $89): bump to $50 + $50 = $100/day.
- Week 3 (if still profitable): $100 + $100 = $200/day. Add Pinterest at $50.
- Don't ramp without checking CAC every 2 days. The kill switch is
  CAC > $89 (full Standard price). Pause that adset.
