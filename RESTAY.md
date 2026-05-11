# RESTAY — patterns from the Airbnb-listing-optimization reference build

[**Restay**](https://restay.agency) ([repo: `Zilla-HQ/airbnb`](https://github.com/Zilla-HQ/airbnb)) is the live reference for cold-outbound-heavy verticals on this template — specifically verticals where the recipient is **platform-proxied** (Airbnb proxies host contact; same shape applies to Instagram creators, gig-platform workers, ticket-marketplace sellers, etc.). This doc catalogs the patterns Restay added on top of the merchant-template that are worth porting to a new fork.

Sitebeat covers the SEO-content-heavy and extension/plugin-distribution patterns ([SEO.md](./SEO.md), [DISTRIBUTION.md](./DISTRIBUTION.md), [X.md](./X.md), [PARTNERS.md](./PARTNERS.md), [COLD_FOLLOWUP.md](./COLD_FOLLOWUP.md)). Restay covers everything below.

---

## Positioning + pricing

**Positioning:** *"Rewrite your listing, restyle your photos, reprice your nights — for a one-time fee less than a month of Guesty."*

**Pricing:** $79 one-time Standard, $129 Rush.

**Why one-time, not subscription:** Every competitor in the STR-tools space runs subscriptions ($20/mo). At a $20 subscription LTV the paid-CAC math is brutal — PriceLabs / Wheelhouse / Beyond / Rankbreeze all run subscriptions and can't run Meta. Restay's $79 one-time means $20–25 CAC actually pencils. The deliberate template lesson: **if your competitors are all on subscription and none of them run paid ads, that's a wedge** — flip to a one-time fee, run the ads.

**Where this applies to a new merchant:** When the vertical is dominated by subscription incumbents AND none of them advertise — a one-time-fee variant is usually a Meta-runnable wedge.

---

## Edit-only image policy (TOS-safe for restricted platforms)

Airbnb's Community Standards forbid AI-generated furniture and structural changes. Restay's photo policy:

- **Allowed:** declutter, relight, color grade, sky replace, HDR, glare removal.
- **Never:** add furniture, remove structural elements, generate rooms.
- **Required:** retain originals, ship them in the delivery zip alongside the edits, include a footer disclosure noting which edits were applied per photo.

The same shape applies to any platform with content-policy restrictions on AI-generated media: Instagram (deepfake policy), Etsy (handmade misrepresentation), Zillow (NAR Code of Ethics Article 12 — virtual staging must be disclosed).

**Files involved in Restay:**
- `lib/falai.ts:generateStagedPreview()` — prompts are edit-only by construction (no "add a sofa," only "declutter the existing sofa")
- `lib/vision.ts` — pre-edit photo scoring; flags photos that are too low-quality to safely edit
- `app/(marketing)/disclosure/page.tsx` — operator-facing copy explaining the photo policy

**To apply to a new merchant:**
- Identify your platform's media policy
- Audit `lib/falai.ts:generateStagedPreview()` prompts so they cannot produce policy-violating outputs even on adversarial inputs
- Ship the disclosure page

---

## Domain warm-up ramp

When the sending subdomain (e.g. `mail.<merchant>.app`) is < 14 days old, sending > 50 cold emails per day will burn deliverability — Gmail and Outlook will park future sends in spam regardless of DKIM/SPF/DMARC perfection. The non-negotiable ramp:

| Day | Volume | Notes |
|---|---|---|
| 0 (warm-up start) | 5–10 transactional-only | Welcome to admins, test sends to your own address |
| 1 | 25 | First small batch to enriched leads who are likely to open (warm intent: came from a referral, partner, or content) |
| 2 | 50 | Same — warm-leaning |
| 3 | 100 | Start mixing in mid-warmth |
| 4 | 200 | Cold OK |
| 5 | 300 | Cold OK |
| 6 | 400 | Cold OK |
| 7 | 500 | Cold OK; first checkpoint — if open rate < 10% or complaint rate > 0.1%, pause and investigate |
| 8–14 | 500–1000 sustained | Daily |
| Week 3+ | 1000–2000 sustained | Depending on conversion |

**Hard rules:**

1. **No "burst then idle"** — once you start the ramp, you must send every weekday at the scheduled volume. Idle days reset reputation. If you can't commit to daily, don't start.
2. **First 7 days: lean on warm/known-good recipients.** Reply rate is the strongest reputation signal. The early ramp must include people who actually open and respond — feed it referrals, manual leads, and content opt-ins before pure cold.
3. **Never blast > 2× the previous day's volume in the first 14 days.** Even 500 → 1000 is a one-day doubling; that's the upper bound.
4. **Daily monitoring of bounce rate and complaint rate.** If bounce > 2% or complaint > 0.1%, halt sends and audit the list (almost always enrichment quality, not domain reputation).

**Restay's implementation (`scripts/send-tier1-batch.ts` → `send-tier6-batch.ts`):** six per-tier scripts that read `outreach_events` for un-sent listings tagged as tier-N, send up to the daily cap (env: `DAILY_SEND_CAP`), then exit. Cron-scheduled at staggered times so the per-batch send rate to Resend stays under 100/min.

**To apply to a new merchant:**

1. Wire `DAILY_SEND_CAP` in `lib/env.ts` + `db/settings.ts:dailySendCap` + Vercel env
2. Cron-schedule batch send scripts at the daily cap, with tier-N gating to spread sends across enrichment-quality cohorts
3. **Don't lift the cap until day 14 minimum, regardless of how clean the early metrics look.** Gmail's reputation memory is multi-week.

See also: `COLD_FOLLOWUP.md` for the 3-touch sequence that follows each tier-N send.

---

## Apify result caching

Each Apify discovery run costs credits and rate-limits against the merchant's monthly cap. Re-scraping the same source 6 times a day for 30 days is **far** more expensive than scraping once and replaying the cached results into the outreach pipeline at the daily send cap.

**Restay's pattern:** preserve the Apify run IDs in a script (`scripts/send-outreach-batch.mjs`) and treat the cached scrape output as a queue the daily send cap drains from. As of the last snapshot, **2,288 unique listings** from 7 cached Apify runs (one day of discovery) had fed weeks of outreach with zero new Apify spend.

```js
// scripts/send-outreach-batch.mjs — sketch
const CACHED_APIFY_RUNS = [
  "abc123def",   // 2026-04-29 13:00 UTC Nashville
  "xyz789ghi",   // 2026-04-29 13:30 UTC Austin
  // …
];
const listings = await fetchListingsFromCachedRuns(CACHED_APIFY_RUNS);
const unSent = listings.filter(l => !l.outreachSentAt);
for (const batch of chunk(unSent, DAILY_SEND_CAP)) {
  // … standard outreach pipeline …
}
```

**To apply to a new merchant:**

1. After your first successful discovery cron, preserve the run IDs.
2. Before unblocking the discovery cron for daily fresh-scraping, audit how long the cached pool will last at your daily send cap.
3. Only re-scrape when the cache is < 1 week of cap remaining.

**Failure mode this avoids:** burning the monthly Apify cap in week 1, getting blocked from new discovery for the rest of the month, having no leads to send to even though daily send capacity is sitting idle.

---

## Free public grader / audit funnel

The single biggest organic-traffic driver Restay shipped. A no-signup public page at `/grade` that takes a user-pasted listing URL, runs a Claude-vision + text scoring pass, and returns a 0–100 score with 3 named fixes. Server-side cost: ~$0.005 per call. Latency: 4–8s.

**Why it works:**

- **Lead magnet:** the user is highly self-qualifying (they pasted their own listing — they know it has problems).
- **SEO surface:** programmatic city pages at `/grade/[city]` × 25 cities each indexed as `keyword + city` combos.
- **Meta retargeting pool:** fires a `Lead` CAPI event on every grader run; once 100+ daily runs sustain, switch on a retargeting ad set against `Lead` users who didn't reach `Purchase`. CPMs on warm audiences are $3–8 vs $15–25 cold.
- **Sharable result:** `/grade/share?u=<base64-url>` renders a custom OG image (`/grade-og`) with the user's grade + score — extremely sharable, especially on Twitter/X.

**Files involved in Restay:**
- `lib/grader.ts` — Claude vision + text scoring; returns `{ score: number, fixes: string[] }`
- `app/api/grade/route.ts` — public endpoint, no auth, rate-limited per IP
- `app/(marketing)/grade/page.tsx` — the main grader UI
- `app/(marketing)/grade/[city]/page.tsx` — programmatic city pages, read from `lib/cities.ts`
- `app/(marketing)/grade/share/page.tsx` — sharable result with OG image
- `app/grade-og/route.tsx` — Edge-runtime OG image renderer
- `lib/cities.ts` — 25-city catalog (Nashville, Austin, Miami, NYC, etc.)

**To apply to a new merchant:**

1. Identify the "input → 0–100 score with 3 fixes" shape for your vertical. (Restay: Airbnb listing URL → score. Sitebeat: website URL → 13-check audit. Real-estate: address → listing-quality score.)
2. Build the scoring function in `lib/<grader>.ts`. Keep it under $0.01 per call.
3. Wire the public route + the API route + the share OG image renderer.
4. Add the city catalog and programmatic per-city pages. SEO compounds: `<keyword> in <city>` ranks because no competitor bothers with 25-city pages.
5. Fire `Lead` CAPI on every grader run (`lib/meta-capi.ts`).

**Don't** put auth on this. The friction of signup at the top of the funnel kills 80% of the lead value.

---

## FLASH-style time-limited promo banner

A site-wide banner that surfaces a time-limited promo code with a hard expiry. Restay shipped `FLASH50` (50% off, expires after ~48h). The promo banner SSRs on first paint to avoid CLS, and `/api/flash-status` checks code expiry server-side so old browsers can't render a stale "offer."

**Files involved in Restay:**
- `app/api/flash-status/route.ts` — returns `{ active: boolean, expiresAt: string | null }`
- `components/marketing/flash-banner.tsx` — SSR component reading the promo state
- Server-side promo creation script — creates the Stripe Promotion Code with end timestamp

**To apply to a new merchant:**

1. Create a Stripe Promotion Code with `expires_at` set.
2. Wire the flash-status route to check the code's expiry.
3. SSR the banner. Don't render on the client — the FOUC kills the urgency effect.
4. Pair with the `Purchase` CAPI event so Meta can see the lift.

**When to use:** new-merchant launch week, end-of-month conversion pushes, recovering an underperforming cohort. **When not to use:** sustained discounting — flash promos are urgency mechanics, not pricing strategy. If you run `FLASH50` every month, you've actually just set the price 50% lower.

---

## Founder essay / manifesto page

A long-form vision page at `/manifesto` that operators link from personal social, podcasts, and outreach. It's the warm-conversion surface for visitors who came from a personal recommendation but aren't ready to paste a URL yet.

**Why it converts:** trust-building. Most cold-outbound merchants look like SaaS-template skin. A real human's vision essay sets the merchant apart and gives warm leads a reason to bookmark + come back.

**Restay's:** `/manifesto` — operator-written, ~800 words on why Restay exists, what it's not (yet another subscription dashboard), and the operator's personal experience. Linked from Twitter bio, podcast appearances, and tier-1 affiliate outreach.

**To apply to a new merchant:**

1. The operator (not the engineer, not Claude) writes ~600–1000 words about *why* this merchant exists.
2. Single-page Next.js route, no MDX needed. Just JSX with `<p>` tags.
3. Open Graph image. Linked from header/footer optionally.

---

## Affiliate program with weekly Stripe payouts

Restay's affiliate economics: 30% of $79 = $23.70 per converted referral, paid weekly via Stripe. Better than every subscription affiliate in the STR space (PriceLabs 10%, Hospitable 25%, Wheelhouse 50%-but-spread-over-12-months-on-a-$20-subscription). One-time payouts are immediate and motivating; subscription affiliate payouts are slow and forgettable.

**Files involved in Restay:**
- `app/(marketing)/partners/page.tsx` — affiliate program landing
- `app/api/partners/apply/route.ts` — application form ingest
- `/p/[handle]` — co-branded partner pages (attribution shortcut: sets `utm_source=partner` + `utm_content=<handle>`)
- `/embed/[handle]` — partner embed iframe (preview card; for partners who want to embed the grader on their own site)
- `/admin/partners` — operator view of applications + leads + commission rollup
- `lib/attribution.ts` — UTM + first-touch cookie capture; persists onto `listings` → joined to `orders` for commission calc

**To apply to a new merchant:**

1. Build the affiliate landing page with the economics front and center (% × ASP × frequency).
2. Wire the partner-handle attribution via UTM (no DB migration needed — use the existing `lib/attribution.ts` first-touch cookie).
3. Build the `/admin/partners` panel — operator needs to see who's converting weekly.
4. Pay weekly via Stripe Connect or manually via Stripe Invoice.

**Tier-1 outreach drafts** to the highest-leverage industry voices in your space ship as `docs/outreach/affiliate-tier1-template.md`.

---

## Operator playbook (the "what only the operator can do" doc)

Some of the most important work is the operator's. Restay codified what only the human can do in `docs/MANUAL_CHECKLIST.md`:

- Branded Google Ads setup ($50/mo set-and-forget)
- Recording the UGC reels (5 vertical reels for Meta + Instagram, rotate every 2 weeks)
- Sending 10 Tier-1 affiliate emails (personalized, can't be automated)
- Reddit organic — 30 min/day, helpful-first, never promotional until handle is trusted
- 3 podcast sponsor inquiries (the operator's voice matters)
- YouTube preroll on hand-picked channels (manual placement targeting)

This is shipped as `docs/operator-playbook-template.md` in this template. Copy + fill.

---

## Files to copy from `Zilla-HQ/airbnb` when wiring these patterns

| Pattern | Files |
|---|---|
| Edit-only image policy | `lib/falai.ts`, `lib/vision.ts`, `app/(marketing)/disclosure/page.tsx` |
| Domain warm-up ramp | `scripts/send-tier1-batch.ts` ... `send-tier6-batch.ts`, `scripts/send-outreach-batch.mjs` |
| Apify result caching | `scripts/send-outreach-batch.mjs` (CACHED_APIFY_RUNS pattern) |
| Free public grader | `lib/grader.ts`, `lib/cities.ts`, `app/api/grade/route.ts`, `app/(marketing)/grade/page.tsx`, `app/(marketing)/grade/[city]/page.tsx`, `app/(marketing)/grade/share/page.tsx`, `app/grade-og/route.tsx` |
| FLASH promo banner | `app/api/flash-status/route.ts`, `components/marketing/flash-banner.tsx` |
| Founder manifesto | `app/(marketing)/manifesto/page.tsx` |
| Affiliate program | `app/(marketing)/partners/page.tsx`, `app/api/partners/apply/route.ts`, `app/(marketing)/p/[handle]/page.tsx`, `app/(marketing)/embed/[handle]/page.tsx`, `app/admin/partners/page.tsx`, `lib/attribution.ts` |
| Multi-step enrichment | `lib/host-enrich.ts` (see [ENRICHMENT.md](./ENRICHMENT.md) for the full breakdown) |
| Operator playbook | `docs/MANUAL_CHECKLIST.md`, `docs/growth-plan.md`, `docs/outreach/*.md`, `docs/creative/reel-scripts.md` |

---

## What's NOT in Restay that other reference merchants have

Restay deliberately skipped several patterns that didn't fit its vertical. Don't assume the absence means "shouldn't ship" — it usually means "didn't fit this vertical specifically."

| Pattern | In Restay? | Where it lives |
|---|---|---|
| Programmatic SEO catalog (~600 URLs) | Partial (~25 city pages) | Sitebeat — see [SEO.md](./SEO.md) |
| Chrome MV3 extension | No | Sitebeat — see [DISTRIBUTION.md](./DISTRIBUTION.md) |
| WordPress plugin | No | Sitebeat — see [DISTRIBUTION.md](./DISTRIBUTION.md) |
| 14-day free trial on subscription | No (Restay is one-time) | Sitebeat — see [COLD_FOLLOWUP.md §trial-vs-promo](./COLD_FOLLOWUP.md) |
| X (Twitter) automation | Not yet wired | Sitebeat (`@Sitebeatapp`) — see [X.md](./X.md) |
| Rewardful affiliate plumbing | No (Restay uses internal partner tracking) | Sitebeat — `components/rewardful.tsx`, `components/ref-capture.tsx` |
| Teardown content engine | No | Sitebeat — `scripts/teardown.mjs` |
| SMS via Twilio | Skipped (A2P 10DLC takes 4 weeks) | Relist — see [SETUP.md](./SETUP.md#twilio) |
| Lob postcards | Skipped (STR hosts are online-native) | Relist |
| Mapbox satellite tiles | Skipped (no satellite ops) | Relist |
| ATTOM/PropertyRadar property data | Skipped (real-estate-specific) | Relist |

---

## Reference

[`Zilla-HQ/airbnb`](https://github.com/Zilla-HQ/airbnb) — live at [restay.agency](https://restay.agency). Open the README + `docs/growth-plan.md` + `MERCHANT.md` for the operator-side framing. Open `lib/host-enrich.ts` + `scripts/send-tier*-batch.ts` + `app/(marketing)/grade/page.tsx` + `app/api/grade/route.ts` for the patterns above.
