# Tier-2 affiliate outreach — bulk-but-personal template

For mid-tier STR coaches, hosting newsletters, regional Facebook group admins, and YouTube channels under ~10k subs. PriceLabs ignores these (their Ambassador program requires 1k+ followers); they convert *better* than Tier-1 because their communities are tighter.

**Send pace:** 5–10 a day. Don't blast in batches — Resend reputation matters even at this volume, and personalization is the conversion lever.

**Email tone:** the Tier-1 emails (in `affiliate-tier1.md`) are 4-paragraph relationship plays. Tier-2 is shorter — 3 paragraphs max. The economics matter more than the personal compliment because the relationship is colder.

---

## Template

**Subject options (rotate):**
- $24/referral, paid Friday — would your hosts find Restay useful?
- Quick partner-program intro — Restay (Airbnb optimization)
- Restay × [their brand] — would there be fit?

**Body:**

Hey [first name],

Quick intro — I'm Jack, founder of Restay (restay.agency). We grade Airbnb listings 0–100 in 10 seconds (free, no signup at restay.agency/grade) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + generates a 30-day pricing report. Delivered in 4 hours.

We pay partners 30% — $24 per converted referral, every Friday via Stripe. No claw-back, no MRR clock. Compared to subscription affiliate programs in this space (PriceLabs 10% / 12mo, Hospitable 25% / 3mo), the per-lead payout is faster and bigger.

I'd love to send you a free Tune-Up on a listing of your choice so you can see the output. If it makes sense after that, I'll get you a unique referral link. Reply with any Airbnb URL — I'll have the full output by tomorrow.

— Jack
restay.agency/partners

---

## Where to find Tier-2 prospects (build a list of 50)

Search these signals on YouTube, Twitter, IG, and Substack:
- "airbnb host coach" / "STR coach" with under 10k followers
- "[city] short-term rental" Facebook groups and their admins
- Substack newsletters about Airbnb hosting / STR investing (small ones)
- Course operators on Teachable / Kajabi who teach Airbnb hosting (find via Google "airbnb course site:teachable.com")
- Regional Airbnb host meetup organizers (search Meetup.com)
- Realtor / STR investor podcasters under 5k downloads/episode

**Quality bar:** an active audience that engages, with content that's specifically about Airbnb hosting (not generic real-estate). Skip:
- Generic affiliate marketers
- Coupon/deal sites
- "Anyone can promote" affiliate aggregators
- Anyone who pitches you back instead of saying yes/no

---

## Tracking

Each Tier-2 partner gets a unique link of the form:
`https://restay.agency/?utm_source=partner&utm_medium=referral&utm_campaign=affiliate&utm_content=<their-handle>`

The handle is whatever's most personal and low-collision (their YouTube handle, Twitter @, or Substack name). The existing `lib/attribution.ts` middleware persists this 30 days into the listing record on first paste, so paid orders attribute back automatically.

When tracking commissions:
1. Query `listings` joined to `orders` where `utm_source='partner'`
2. Group by `utm_content` for the partner-level breakdown
3. Pay 30% of `amountCents` for each `paid` order, every Friday via Stripe Connect (or manual transfer until you cross 10+ active partners)

---

## When NOT to send

If their audience is:
- Mostly outside the US (Restay v1 is US-only — conversion will be poor)
- Generic real estate (not specifically STR / Airbnb hosting)
- Overlapping heavily with a Tier-1 partner you've already approved (don't dilute Tier-1's incentive)

---

## After sending

- **Wait 7 days, one bump** ("hey, bumping in case this got buried"). Then drop.
- **If they reply with a yes:** ship the free Tune-Up within 24h, then send the partner link with a "you're approved, here's your link" email.
- **If they reply asking custom rate:** standard tiering — under 1k audience = standard 30%; 1–10k = standard 30%; 10k+ = negotiate up to 35–40%, custom Stripe Connect setup.
- **Track approval rate:** if your reply rate is below 5% of sends, the personal observation in the opener isn't strong enough; rewrite.
