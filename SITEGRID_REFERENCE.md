# SiteGrid — reference production merchant

> **What this doc is:** SiteGrid (https://github.com/Zilla-HQ/sitegrid) is the first production merchant built on the Zilla pattern. This template inherits its proven capabilities. Use this doc as the source of truth for **what the template can do, what each capability is for, and how SiteGrid wired it in production**. The corresponding code lives in `lib/`, `inngest/functions/`, and `app/`.

## What SiteGrid sells

- **$199 one-time done-for-you websites** for local service businesses, delivered in 24 hours.
- 19 verticals: dental, chiro, doctors, gyms, yoga, pilates, CrossFit, hair, spa, law, CPA, plumbers, electricians, restaurants, boutiques, auto repair, realtors, pet groomers, generic services.
- Optional $99/yr renewal for hosting in year 2+.
- 10% founding-customer code: `FOUNDING10`.
- CAC ceiling $75, margin floor 50%.

## Stack note

SiteGrid runs on Vite + Express + Wouter — not this template's Next.js + Inngest. This template ports SiteGrid's patterns into Next.js + Inngest equivalents so future merchants can fork cleanly. The capabilities are identical; only the wiring differs.

| Concept | SiteGrid (Express) | This template (Next.js) |
|---|---|---|
| HTTP routes | `server/routes.ts` | `app/**/route.ts`, `app/**/page.tsx` |
| Background jobs | `server/cron/*.ts` via `node-cron` | `inngest/functions/*.ts` |
| ORM | Drizzle + Neon | Drizzle + Postgres |
| Auth | Clerk (frontend + backend SDKs) | Clerk Next.js middleware |
| Email | Resend + SendGrid (legacy) + Lob | Resend + Lob |
| AI | Anthropic Claude (Haiku 4.5) | Anthropic Claude + fal.ai |

## Capabilities inherited from SiteGrid (with file pointers)

### 1. Affiliate program with /ref/:code

- **Pattern:** Partner gets a code (e.g. `JOE`). Visiting `/ref/JOE` drops a 90-day cookie + writes `referrals` row (`status='clicked'`). Cookie flows into Stripe Checkout metadata as `ref_code`. Stripe webhook reads it back and writes `status='purchased'`.
- **Tiered commissions:** Standard ($50/sale), Silver ($100/sale, 5+ sales), Gold ($250/sale, 10+ sales). Override per merchant in `lib/affiliate.ts:AFFILIATE_TIERS`.
- **Files:** `lib/affiliate.ts`, `app/ref/[code]/route.ts`, `app/api/admin/referrals/route.ts`.
- **Schema:** `referrals` table.
- **Doc:** [AFFILIATE.md](./AFFILIATE.md).

### 2. Sponsor / partner / press outreach (separate from cold outreach)

- **Pattern:** Distinct lifecycle from selling-to-listings. Pitching influential audiences (podcasters, newsletter editors, partners, press). Inbound replies route to the contact's thread BEFORE the listing-email match — sponsors get human responses, never auto-classifier.
- **Sender split:** uses `SPONSOR_SEND_DOMAIN` (defaults to a different domain than the cold-outreach loop) so a sponsor flagging spam can't poison the revenue-engine domain.
- **Cadence:** Touch 1 (initial) → Touch 2 (day 7) → Touch 3 (day 14) → archive (day 21).
- **Files:** `lib/sponsor-contacts.ts`, `inngest/functions/sponsor-discover.ts`, `sponsor-send.ts`, `sponsor-follow-up.ts`.
- **Schema:** `outbound_contacts`, `outbound_contact_messages`.
- **Doc:** [SPONSORS.md](./SPONSORS.md).

### 3. Abandoned-checkout follow-up

- **Pattern:** Listings/customers who hit Stripe checkout 4+ hours ago without paying get ONE human-tone "what's blocking you?" email. No promo code, no automation tone — same pattern as a founder closer.
- **Why:** SiteGrid identified this after a lead reached Stripe checkout 9 times without paying. A single direct email converts mid-funnel anxiety into a reply (which we can answer) or a definitive NO (so we stop spending).
- **Idempotency:** One per listing, ever. Tracked in `outreach_events` with `template_id='abandoned_checkout'`.
- **Files:** `inngest/functions/abandoned-checkout.ts`.
- **Doc:** [ABANDONED_CHECKOUT.md](./ABANDONED_CHECKOUT.md).

### 4. Direct mail postcards via Lob

- **Pattern:** Weekday afternoons (17:00 UTC, before Lob's same-business-day cutoff). 4x6 postcards with the customer's hero photo on the front + a single CTA + URL on the back. Per-piece billed.
- **Budget-capped per-run and per-day** (defaults: $50/day, 20 pieces/run).
- **Idempotency:** Never re-mail the same listing (`direct_mail_events` exclusion subquery).
- **Files:** `lib/lob-postcards.ts`, `inngest/functions/direct-mail.ts`.
- **Schema:** `direct_mail_events`.
- **Doc:** [DIRECT_MAIL.md](./DIRECT_MAIL.md).

### 5. Programmatic SEO at scale (N × M)

- **Pattern:** Two URL shapes — `/seo/website-for/<vertical>` (per-vertical) and `/seo/<city>/<vertical>-website` (per city × vertical). For SiteGrid's 19 verticals × 30 cities, that's 589 pages.
- **Each page:** unique title + description + h1 + JSON-LD `Service` schema + `areaServed`.
- **Sitemap:** every URL shipped via `sitemapEntries()` helper.
- **Files:** `lib/programmatic-seo.ts`.
- **Doc:** [PROGRAMMATIC_SEO.md](./PROGRAMMATIC_SEO.md).

### 6. Google Ads autonomy (full runtime, was docs-only)

- **Hourly sync** of last-7d metrics into `campaigns` table (`platform='google'`).
- **Daily autonomy at 02:00 UTC:** pause campaigns where CAC > $75 after $50+ spent; resume previously-paused campaigns whose 7d window is now profitable (margin floor = 50% of $199 → CAC < $99.50, ≥3 conversions to avoid noise-driven resumes).
- **Branded-defense budget scaler at 02:30 UTC** (optional — independent of autonomy).
- **No-ops silently** when Google Ads envs aren't configured.
- **Files:** `lib/google-ads-client.ts`, `inngest/functions/google-ads-sync.ts`, `inngest/functions/google-ads-autonomy.ts`.
- **Doc:** [GOOGLE_ADS.md](./GOOGLE_ADS.md) (already existed; extend per the patterns).

### 7. Spectacle layer (public agent persona)

- **Surfaces:** `/live` (real-time counters), `/diary` (markdown journal), `/bench` (model leaderboard), `/llms.txt`, `/unmute/:token` (HMAC opt-in flip).
- **Customer permission flow:** Default-redacted on `/live` ("M—'s Dance Studio"). Customer flips via `/unmute/:token` link in the post-purchase email. HMAC-gated; stateless mint.
- **Auto-tweet:** diary entries auto-tweeted hourly at :15 (dry-run logged when `TWITTER_ENABLED=false`). Weekly recap tweet Monday 00:00 UTC.
- **Disabled by default:** set `SPECTACLE_ENABLED=true` to surface.
- **Files:** `lib/spectacle.ts`, `lib/unmute-token.ts`, `app/live/page.tsx`, `app/diary/page.tsx`, `app/diary/[slug]/page.tsx`, `app/bench/page.tsx`, `app/llms.txt/route.ts`, `app/unmute/[token]/route.ts`, `inngest/functions/diary-publish-tweet.ts`, `inngest/functions/spectacle-weekly-recap-tweet.ts`.
- **Schema:** `agent_thoughts`, `bench_runs`, `outbound_tweets`.
- **Doc:** [SPECTACLE.md](./SPECTACLE.md).

### 8. Weekly operator digest

- **Monday 13:00 UTC** — one email summarizing every channel from the past 7 days. Operator never has to log in to know how the business is doing.
- **Sections:** revenue + funnel, paid channels with CAC, direct mail, sponsor outreach with open replies, affiliate program leaders.
- **Files:** `inngest/functions/weekly-digest.ts`.

### 9. Customer-site footer widget (organic acquisition)

- **Pattern:** Every site built for a customer includes `<script src=".../widget/footer.js" data-slug="<slug>">`. Appends a small "Made by <Brand>" footer with a `/?ref=site-<slug>` link.
- **Impact:** Every customer site becomes an organic acquisition surface. Visitors who click get attributed via the affiliate cookie flow with a `site-<slug>` code.
- **Files:** `app/widget/footer.js/route.ts`.

### 10. Email blocklist (explicit opt-out + complaint tracking)

- **Permanent opt-out list.** Anything here must never be cold-emailed again, regardless of how the outreach loop discovered the address.
- **Populated by:** Resend complaint webhooks → `complained`, inbound unsub replies (List-Unsubscribe mailto + Claude classifier `unsubscribe` bucket) → `unsubscribed`, manual operator → `manual`.
- **Files:** `lib/email-blocklist.ts`.
- **Schema:** `email_blocklist`.

## Patterns not yet ported (deliberate)

These are SiteGrid-specific or too vertical-coupled to port cleanly. Listed here so you know they exist if you want to study or replicate.

- **TikTok content plan + UGC creator brief.** Operator playbooks for organic UGC. Lives in [TIKTOK.md](./TIKTOK.md) and [UGC.md](./UGC.md).
- **Email-template library** with per-vertical concern bullets (restaurants worry about reservations breaking, healthcare about patient portals, legal about referral partners). Pattern documented in [EMAILS.md](./EMAILS.md); concrete templates are vertical-specific.
- **Klarna/Afterpay BNPL at Stripe checkout.** Trivial to enable on a per-merchant basis (`payment_method_types` array) — set per merchant, not template default.
- **showcase gallery + exit-intent modal.** UI patterns — not template-default since they're style-bound.
- **The Earl persona itself** (voice notes, diary tone, "small-town American craftsman, Mr. Rogers + Bob's Burgers warmth"). Per-merchant choice — the template ships the mechanism, not the personality.

## Environment variables added by this set

See `.env.example` for the full annotated list. Quick reference:

```
# Affiliate
NEXT_PUBLIC_BRAND_NAME

# Sponsor / partner / press outreach
SPONSOR_OUTREACH_ENABLED=false       # opt-in to autosend
SPONSOR_SEND_DOMAIN=                 # split sender domain
SPONSOR_FROM_LOCAL=hello
SPONSOR_FROM_NAME=
SPONSOR_REPLY_TO=
SPONSOR_OUTREACH_PER_RUN_CAP=10
SPONSOR_OUTREACH_DAILY_CAP=10
SPONSOR_OUTREACH_WARMUP_START=3
SPONSOR_OUTREACH_WARMUP_DAYS=14
SPONSOR_OUTREACH_WARMUP_STARTED=     # override; defaults to first-send-at
SPONSOR_TOUCH2_AFTER_DAYS=7
SPONSOR_TOUCH3_AFTER_DAYS=14
SPONSOR_ARCHIVE_AFTER_DAYS=21
SPONSOR_FOLLOWUP_PER_RUN_CAP=10
SPONSOR_DISCOVER_MAX_PER_RUN=30
SPONSOR_SEED_DOMAINS=                # "domain|org|kind|tplId,..."

# Abandoned checkout
ABANDONED_CHECKOUT_DELAY_HOURS=4
ABANDONED_CHECKOUT_MAX_PER_RUN=10
FOUNDER_NAME=
FOUNDER_REPLY_EMAIL=

# Direct mail (Lob)
LOB_API_KEY=
LOB_FROM_NAME=
LOB_FROM_LINE1=
LOB_FROM_LINE2=
LOB_FROM_CITY=
LOB_FROM_STATE=
LOB_FROM_ZIP=
DIRECT_MAIL_PER_RUN_CAP=20
DIRECT_MAIL_DAILY_BUDGET_CENTS=5000  # $50/day default
DIRECT_MAIL_ASSUMED_COST_CENTS=100   # estimate per piece before Lob responds
POSTCARD_BRAND_NAME=
POSTCARD_CTA_TITLE=
POSTCARD_CTA_BODY=
POSTCARD_PRICE_LABEL=

# Google Ads autonomy
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_TARGET_CAC_USD=75
GOOGLE_PURCHASE_VALUE_USD=199
GOOGLE_MIN_SPEND_USD=50
GOOGLE_MIN_CONVERSIONS_FOR_RESUME=3

# Spectacle layer
SPECTACLE_ENABLED=false
AGENT_NAME=
AGENT_TAGLINE=
AGENT_TWITTER_HANDLE=
AGENT_VOICE_NOTES=
DIARY_DIR=                           # defaults to ./content/diary
TWITTER_ENABLED=false                # dry-run when false
SHOW_PUBLICLY_SECRET=                # HMAC key for unmute tokens

# Weekly digest
OPERATOR_NOTIFY_EMAIL=

# llms.txt
NEXT_PUBLIC_LLMS_DESCRIPTION=
NEXT_PUBLIC_PRODUCT_NOUN=
NEXT_PUBLIC_PRICE_LABEL=
```

## When to lean on this reference

- **Forking a new merchant:** start by reading [MERCHANT.md](./MERCHANT.md) for the config knobs. This doc is for *which knobs to set* and *why each capability exists*.
- **Adding a new channel** that's already in SiteGrid: don't reinvent — open the corresponding `lib/` file in this template and read its file-level comment.
- **A SiteGrid pattern that's missing here:** open a PR. The pattern probably *should* be in the template; check the "Patterns not yet ported" section above first.
