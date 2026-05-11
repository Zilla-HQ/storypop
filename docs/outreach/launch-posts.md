# Launch posts — Indie Hackers, Show HN, ProductHunt

Three launch posts ready to fire. Each has distinct framing — Indie Hackers leans into the build-in-public/revenue angle, Show HN leans into the technical detail, ProductHunt leans into the consumer pitch. Don't post all three in the same week — space 5-7 days apart.

---

## Indie Hackers — "Show IH" post

**Title:** Built an Airbnb listing optimizer in 90 days. First $79 customer landed yesterday.

**Body:**

I run [Restay](https://restay.agency) — a $79 one-time service that rewrites your Airbnb listing's copy, restyles 10 photos, and gives you a 30-day pricing report, delivered in under 4 hours.

**The setup:**
- Most Airbnb hosts set their listing up once and never come back. Photos go flat, copy goes stale, pricing drifts.
- Existing optimization tools are subscription SaaS ($30-200/mo) — overkill if you just want a sweep.
- I built Restay as a one-time thing. No PMS migration, no monthly fee.

**The build (90 days):**
- Next.js 15 + Postgres (Supabase) + Inngest for the pipeline
- Apify for Airbnb scraping
- fal.ai for photo restyling (edit-only — Airbnb policy compliant, no furniture added/removed)
- Anthropic Claude for copy + photo grading
- Stripe for one-time checkout, Resend for transactional + outreach email
- All on Vercel — total infra ~$45/mo

**What's working:**
- Free public grader at [restay.agency/grade](https://restay.agency/grade) — paste any Airbnb URL, 0-100 score in 10 seconds. ~225 grader runs in first 2 weeks (mostly Meta ads-driven).
- 10 industry-influencer outreach emails just landed (Sean Rakidzich, Robuilt, TFV, Bill Faeth, etc.) — relationships > affiliate spam.
- 25 city pages + 25 host-vertical pages for SEO. Indexing now.

**What I learned the hard way:**
- Airbnb's photo CDN includes "platform asset" cartoon thumbnails that look real. We grabbed them as listing photos for our first paid customer — he saw stylized gift boxes instead of his real bedroom and refunded. Photo-source filters now strict.
- fal.ai silently runs out of credits and returns 403s. Built a `provider-errors.ts` heuristic detector + auto-pause + ops alert pattern so the next $79 doesn't go into a black hole.

**What I'd love feedback on:**
- $79 vs. $99 vs. $129 — is one-time pricing sustainable, or am I leaving money on the table by not subscription'ing?
- The free grader: is it cannibalizing the paid product, or is it the funnel?
- Anyone running ads at $1.50-2 CPLPV ($5-8 CAC) with this CR structure — is that healthy for a $79 product?

Repo (private — happy to walk through specific patterns over email): jack@restay.agency

---

## Show HN — technical post

**Title:** Show HN: Restay – Airbnb listing optimizer (free grader + $79 one-time tune-up)

**Body:**

Hey HN — I built [Restay](https://restay.agency), a free public grader (paste any Airbnb URL, get a 0-100 score on photos / copy / signals) and a paid one-time service that rewrites the listing and restyles 10 photos in under 4 hours.

The grader: <https://restay.agency/grade>. No signup, runs Anthropic Claude vision on 3 photos for lighting/framing/clutter, scores copy length/specificity, and pulls listing signals (review count, rating, photo count). Returns 0-100 + the 3 highest-impact fixes.

**Stack notes:**
- Next.js 15 App Router + Postgres + Drizzle. Inngest for the long-running pipeline (preview gen + fulfillment can take 5-10 min).
- Photo restyling via fal.ai (edit-only — declutter, relight, color grade, sky replace). Airbnb's TOS prohibits AI-added furniture, so the prompts are constrained. Originals retained for legal cover.
- Claude for both vision (grader) and text (rewrite). The rewrite is constrained to facts already in the original listing — no hallucinated amenities.
- Stripe Checkout + auto-promo-code cookie capture. Apple Pay / Google Pay enabled because most Airbnb hosts browse on iPhone.
- Operator-side: Resend for outbound email, classifier on inbound replies to auto-handle decline / unsubscribe / complex.

**The interesting bug postmortem:**

First paid customer refunded within 17 minutes. Postmortem turned up a 4-bug chain:
1. Airbnb's CDN serves `/AirbnbPlatformAssets/...` cartoon thumbnails alongside real listing photos. We grabbed them. Customer saw a stylized gift box where his bedroom photo should've been.
2. fal.ai silently 403'd on out-of-credits. We accepted $79, scheduled fulfillment, and the pipeline 403'd into a black hole.
3. No "we got your order" email — just radio silence between Stripe success and an output that never came.
4. No alarm on stuck-in-paid orders.

Fixed all 4. Wrote up the case study in our merchant-template docs (we run vertical-SaaS forks; this is one of them).

**Why one-time vs subscription:**
Most Airbnb optimization tools are $30-200/mo SaaS. Hosts running 1-3 listings don't need that — they need the work done once, properly. One-time pricing matches the demand pattern.

Happy to answer anything technical.

---

## ProductHunt — launch (save for week of, not day-of)

**Tagline:** Free 10-second Airbnb listing grader + $79 done-for-you tune-up

**Description:**

Restay grades any Airbnb listing in 10 seconds — no signup. Paste your URL, get a 0-100 score across photos, copy, and signals, plus the 3 fixes that would lift bookings the most.

Like the score? The full Tune-Up rewrites your title and description, restyles 10 photos (edit-only — declutter, relight, color grade), and ships a 30-day pricing report. $79 one-time, delivered in under 4 hours, 14-day full-refund window.

Built for hosts running 1-3 listings who don't need subscription SaaS — they need the optimization done once, properly. Less than a month of Guesty.

**Topics:** Travel · Real Estate · AI · Marketing automation

**Maker comment (post immediately after launch goes live):**

Hi PH — Jack here, founder of Restay. Three things I'd love feedback on:

1. The free grader at [restay.agency/grade](https://restay.agency/grade) — is the score believable / actionable? Try any listing.
2. The $79 one-time vs subscription pricing — am I leaving margin on the table?
3. The "Tune-Up" framing vs alternatives ("Refresh," "Audit," "Optimize") — what reads cleanest as a service?

I'll be here all day answering questions — reply with any URL and I'll personally walk through what we'd change.

---

## Posting playbook

**Indie Hackers:**
- Post Mon-Wed AM ET. Avoid Friday/Sat (low engagement).
- Reply to every comment within 30 min — IH algorithm rewards thread engagement.
- Don't link the post itself anywhere for first 6h (keeps the comments on-platform).

**Show HN:**
- Submit Tuesday 8-9 AM ET (highest hit rate by HN data).
- Title: keep "Show HN:" prefix exact. Don't add emoji or marketing speak.
- Be online to reply for first 4h — front-page survival depends on early thread velocity.

**ProductHunt:**
- Submit at 12:01 AM Pacific Mon-Wed.
- Pre-stage 10-15 supporters who will upvote in first hour (without commenting from same IPs).
- Maker comment goes up at the moment the launch is live (ranks higher than retroactive).
- Reply to every comment for first 24h.
