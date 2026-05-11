# Restay merchant template — emails, UI flows, and test plan

This is the canonical reference for every customer-facing email Restay sends and every screen a host hits on the way to purchase. The merchant-template structure here mirrors the SiteGrid playbook so a new vertical can be forked with a find-and-replace.

The fundamental difference from SiteGrid: **Restay delivers a downloadable package, not a hosted site.** There is no customize dashboard — fulfillment ships a zip of restyled photos, a rewritten title + description, and a pricing report. Everything else (discovery, outreach, classification, operator-notify) follows the same pattern.

## Variables used throughout

| Placeholder | What it is | Example |
|---|---|---|
| `{listingShortAddress}` | First line of the host's listing address (Airbnb fuzzes city-level data pre-booking, so this is "Austin, TX" granularity) | "Austin, TX" |
| `{firstName}` | Host first name from Airbnb's `host.name` (split on whitespace; falls back to `there`) | "Maria" |
| `{listingType}` | `entire_home` / `private_room` / `shared_room` / `hotel_room` / `other` | `entire_home` |
| `{listingTypeLabel}` | Human label used in copy | "entire home" |
| `{photoCount}` | Total photos on the host's current listing | `18` |
| `{reviewCount}` | Airbnb review count | `47` |
| `{avgRating}` | Airbnb avg rating, two decimals | `4.83` |
| `{hostNightly}` | Host's current nightly rate, pre-formatted | `$245` |
| `{compMedianNightly}` | Apify-derived comp median for matching bedrooms | `$310` |
| `{previewBeforeUrl}` | Public R2 URL of the host's worst photo (the "before") | `https://r2.restay.agency/p/.../before.jpg` |
| `{previewAfterUrl}` | fal.ai-restyled "after" of the same room | `https://r2.restay.agency/p/.../after.jpg` |
| `{listingPageUrl}` | Restay listing page (free audit + checkout CTA) | `https://restay.agency/l/austin-tx-1490126510429751392` |
| `{checkoutUrl}` | Direct Stripe Checkout for this listing's tune-up | `https://restay.agency/l/austin-tx-1490126510429751392#buy` |
| `{deliveryUrl}` | Post-payment download page (token-gated) | `https://restay.agency/delivery/ord_01H...` |
| `{zipUrl}` | Direct R2-signed link to the deliverable zip (30-day TTL) | `https://r2.restay.agency/...zip?...` |
| `{unsubUrl}` | RFC 8058 one-click unsubscribe | `https://restay.agency/unsubscribe?t=<hmac>` |
| `{supportEmail}` | One inbox for support / billing / refunds | `support@restay.agency` |
| `{repliesEmail}` | Operator inbox where every classified inbound is mirrored | `jack@seifdn.org` |
| `{senderName}` | "From" name shown to recipients | `Restay` |
| `{senderAddress}` | Full from address | `outreach@mail.restay.agency` |
| `{tuneupPrice}` | Standard Tune-Up price | `$79` |
| `{rushPrice}` | 24-hour-turnaround Tune-Up price | `$129` |
| `{photoOnlyPrice}` | Photo Restyle alone | `$49` |
| `{promoCode}` | Active founding-host Stripe promotion code (see §promo) | `FOUNDING50` |
| `{promoDiscountPct}` | Percent off | `25` |
| `{promoExpiryDays}` | Promo lifespan after first reply | `7` |

### Listing type → label cheat sheet

| `listingType` | `{listingTypeLabel}` |
|---|---|
| `entire_home` | entire home |
| `private_room` | private room |
| `shared_room` | shared room |
| `hotel_room` | boutique-hotel room |
| `other` | listing |

---

## Email 1 — Cold outreach (sent by `inngest/functions/outreach.ts`)

The first touch. Short, peer-to-peer, leads with three observed audit findings (one copy issue, one photo issue, one pricing observation). Single CTA to the free audit page. No discount mention — the discount is a "you earned this by replying" reward, applied in Email 2.

**From:** `{senderName} <{senderAddress}>`
**Reply-To:** `{senderAddress}` (so inbound replies hit the Resend inbound webhook → `inngest/functions/reply-handler.ts`)
**Subject:** `{listingShortAddress} — your free 60-second Airbnb audit`

```
Hi {firstName},

Quick note about your {listingTypeLabel} in {listingShortAddress}. I ran your public listing through our audit pipeline this morning and pulled three things worth a look:

  • Title: {one-line copy observation — typically "buries the strongest selling point" or "leads with location, not the experience"}
  • Photos: {one-line photo observation — typically "kitchen shot is underexposed", "no exterior hero", "first 3 thumbnails repeat the same room"}
  • Pricing: {one-line comp-note — populated when pricingReport row exists, otherwise omitted}

Free side-by-side preview here (one room restyled to spec, no signup):
{listingPageUrl}

If it's useful, the full Tune-Up — rewritten title + description, 10 restyled photos, 30-day pricing recommendation — is {tuneupPrice} one-time. If not, no follow-up.

— {senderName}
```

**Required headers (compliance):**
- `List-Unsubscribe: <{unsubUrl}>, <mailto:unsubscribe+{unsubToken}@{senderDomain}>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- `Reply-To: {senderAddress}`

**Why a "free audit" hook, not a sample preview:** SiteGrid sends a complete spec'd-out website preview because the deliverable IS the site. Restay's deliverable is a package that takes ~10 min of fal.ai compute per order, so we can't generate the full thing on spec. The single before/after photo is the spec preview — it proves the edit-only pipeline works without burning the full $0.50–$1.00 of compute per cold prospect.

**HTML version** must include `<head><meta charset="utf-8"></head>` (we hit mojibake on em dashes in cross-merchant testing).

---

## Email 2 — Auto-reply when prospect asks about price (`price_question`)

Triggered by `inngest/functions/reply-handler.ts` when `classifyReply()` returns `price_question`. Anyone asking about price is in buying mode — pre-apply the founding-host discount, fixed expiry.

**From:** `{senderName} <{senderAddress}>`
**Subject:** `Re: {original subject}`

```
Hi {firstName},

Three options, all one-time fees, no subscription:

  • Tune-Up — {tuneupPrice} — rewritten title + description, 10 restyled photos, 30-day pricing recommendation. 48-hour turnaround.
  • Rush Tune-Up — {rushPrice} — same package, 24-hour turnaround.
  • Photo Restyle only — {photoOnlyPrice} — 10 restyled photos, no copy or pricing work.

Since you replied within 7 days of our first email, I've applied a {promoDiscountPct}% founding-host discount to your link below. It's locked in for {promoExpiryDays} days.

Click to pay (discount pre-applied):
{checkoutUrl}?code={promoCode}

What you get and when:

  1. Confirmation email from {supportEmail} the moment Stripe clears. Includes a private link to download your zip.

  2. Restyled photos (declutter, relight, color grade, replace overcast skies). Originals always retained. We never add or remove furniture — Airbnb's listing-photo policy forbids it, and we're built around that constraint.

  3. Rewritten title + description tuned to your listing's strongest signals (review highlights, neighborhood, amenity stack).

  4. A 30-day pricing report comparing your nightly rate against ~30 comparable listings in {listingShortAddress} — comp median, p25, p75, and a recommended weekday + weekend rate.

For anything else — re-run with a different style, additional photos beyond the first 10, custom requests — just email {supportEmail} and we'll handle it within 24 hours.

— {senderName}
```

**Why deterministic, not LLM-generated:** an LLM rewrite occasionally drops the checkout link, shifts the price, or contradicts the discount math. The template is fixed and tested; only the `{variables}` change. Restay's existing `draftAutoReply()` LLM path should be replaced by this template — see "Code gaps" below.

---

## Email 3 — Auto-reply when prospect asks how the edits work (`style_question`)

Same template family as Email 2, narrower body — the host's question is "what do you actually do" not "how much."

**From:** `{senderName} <{senderAddress}>`
**Subject:** `Re: {original subject}`

```
Hi {firstName},

What we edit and what we don't:

  EDITED:
  • Color grade — fix yellow tungsten interiors, even out exposure
  • Relight — brighten dark rooms, reduce shadow on key surfaces
  • Declutter — remove cables, bottles, mail, distracting objects on counters
  • Skies — replace overcast with bright-overcast (no fake sun, no impossible blue)
  • Crop — straighten and recompose for Airbnb thumbnail aspect

  NOT EDITED:
  • We never add furniture, plants, art, or rugs — Airbnb policy forbids it
  • We never remove permanent fixtures (cabinets, fans, outlets)
  • We never alter property dimensions, ceiling height, or window placement
  • Originals are retained alongside the edits

The full Tune-Up — 10 restyled photos plus rewritten copy and a pricing report — is {tuneupPrice} one-time. Photo-only is {photoOnlyPrice}.

{checkoutUrl}

— {senderName}
```

---

## Email 4 — Graceful close on decline (`decline`)

Triggered when `classifyReply()` returns `decline`. Acknowledges and stops follow-ups. Keeps the audit page warm in case they change their mind.

```
Hi {firstName},

Totally understand — appreciate you replying. I'll stop bumping you.

If anything changes, your free audit is at {listingPageUrl} and stays up for a few weeks.

— {senderName}
```

**Currently NOT wired in code:** `reply-handler.ts:144-146` returns `acknowledged (no reply)` for decline. This template should be sent — declines are an opportunity to leave a positive last impression, and the audit page has a 30-day cookie attribution window so a delayed return-visit still ties back to the original outreach.

---

## Email 5 — Post-payment fulfillment (sent by `inngest/functions/fulfillment.ts`)

Fires automatically after the Stripe webhook flips the order to `paid` and the fulfillment function finishes restyling photos, rewriting copy, computing pricing, and packaging the zip. Routes the customer to the token-gated download page.

**From:** `{senderName} <{senderAddress}>`
**Subject:** `Your Restay tune-up is ready — {listingShortAddress}`

```
Hi {firstName},

Your tune-up for {listingShortAddress} is ready. Total turnaround: {turnaroundHours} hours.

Download everything:
{deliveryUrl}

What's in the package:
  • {photoCount} restyled photos (originals retained, ready for direct upload to Airbnb)
  • Rewritten title + description (paste-into-Airbnb format)
  • Pricing report — your nightly rate vs. {compSampleSize} comparable listings in {listingShortAddress}
      Current: {hostNightly}
      Comp median: {compMedianNightly}
      Recommended weekday: {recommendedWeekday}
      Recommended weekend: {recommendedWeekend}

The download page link expires in 30 days. The signed zip below also works directly:
{zipUrl}

For anything else — additional photo edits, copy revisions, or a re-run with different style settings — email {supportEmail}.

— The {senderName} Team
```

**Critical wiring:** `{deliveryUrl}` is `/delivery/[orderId]` — gated server-side on `order.status = 'fulfilled'`. The R2-signed `{zipUrl}` is independent (signed for 30 days at order completion). If the customer paid with an email different from `listing.agentEmail`, the Stripe webhook handler must populate `order.customerEmail` from `session.customer_email` BEFORE `fulfillment.ts` reads it, otherwise the delivery email goes to the wrong inbox.

---

## Email 6 — Operator notification on every classified reply

Goes to the operator inbox so hot leads are visible even when the auto-reply already went out. `Reply-To` is set to the prospect, so hitting Reply replies directly to them.

**From:** `{senderName} Agent <{senderAddress}>`
**To:** `{repliesEmail}` (currently `jack@seifdn.org`)
**Reply-To:** `{prospectEmail}` (so Reply works)
**Subject:** `🔥 {classification} reply from {listingShortAddress}` (emoji prefix per classification)

```
New inbound reply on the cold-outreach loop.

CLASSIFICATION:    {classification}
LISTING:           {listingShortAddress} ({listingTypeLabel}, {photoCount} photos)
HOST:              {firstName} {lastName}
HOST EMAIL:        {prospectEmail}
HOST EMAIL SOURCE: {hostEmailSource}    [hunter / pattern-guess / manual / self-serve]
NIGHTLY RATE:      {hostNightly}
SUPERHOST:         {isSuperhost}
REVIEWS:           {reviewCount} ({avgRating} avg)

SUBJECT:           {subject}

THEIR MESSAGE:
{bodyText}

AUTO-REPLY WE SENT (delivered):
{autoReplyBody}

Listing detail:    {appUrl}/admin/outreach/{outreachEventId}
Their audit page:  {listingPageUrl}
Resend in admin:   {appUrl}/admin/email/{resendId}

— {senderName} agent
```

**Emoji per classification:**
- `price_question` → 💰
- `style_question` → 🎨
- `decline` → ↘️
- `unsubscribe` → ✋
- `complex` → ⚠️

**Currently NOT wired in code:** `reply-handler.ts:114-141` only fires `alert-admin` for `complex`. Per SiteGrid's rule (and our own postmortems), this should fire on EVERY classification — operator visibility is too cheap to skip. Fix is in "Code gaps" below.

---

## UI Flow 1 — Cold-outreach prospect path (autonomous)

Runs without a human in the loop except for replies and refunds.

```
[discovery cron 0 13 * * *] → tri_angle/airbnb-scraper, async start + 24-min poll
   ↓
new listings land in `listings` table (source='airbnb', no agentEmail)
   ↓
listings/ingested event → [qualification fn]
   ↓
- enrichHostEmail() via Hunter / pattern-guess (skipped for self-serve)
- scoreListingPhotos() via OpenAI vision (1–10 per photo, drives staging value)
- scoreAgentValue() — Superhost + review count + nightly rate
- isQualified() — pass thresholds
   ↓
listings/qualified event → [preview fn]
   ↓
- pickBestForStaging — top 2 photos by staging value
- generateStagedPreview via fal.ai Flux Kontext (edit-only)
- watermark "PREVIEW — Restay" with applyTextWatermark
- upload to R2, signed URL
   ↓
preview/ready event → [outreach fn]
   ↓
- daily-cap check ({DAILY_SEND_CAP})
- complaint-rate kill switch (>0.3% over last 24h with n≥50 → halt)
- pricing report read (optional, populated if qualification ran one)
- draftOutreachEmail via Claude → subject + bodyText + bodyMjml
- sendComplianceEmail via Resend (one of {senderDomains}, rotated by daily count)
- pre-insert outreach_event row (status=queued), then update with resend_id once sent
   ↓
outreach/sent event → [outreachScheduleFollowupFn] step.sleep 72h → followup/check
   ↓
prospect REPLIES (any inbound to outreach@mail.restay.agency)
   ↓
Resend inbound webhook → /api/resend/webhook → inbound/email event → [reply-handler fn]
   ↓
- match listing by from-address
- classifyReply() via Claude → 5 buckets
- record_inbound row in messages table
- branch:
    unsubscribe → blacklist email + mark outreach_event status='unsubscribed'
    complex     → flag message.humanFlag=true + Email 6 to operator
    price_q     → Email 2 + Email 6 to operator
    style_q     → Email 3 + Email 6 to operator
    decline     → Email 4 + Email 6 to operator
   ↓
prospect clicks {checkoutUrl} → /l/[slug] page → "Buy Tune-Up — {tuneupPrice}"
   ↓
[from here the path is identical to self-serve]
```

## UI Flow 2 — Self-serve URL path (host pastes their own listing)

Same destination as cold outreach, kicked off by the host instead of the discovery cron. Bypasses qualification scoring (the host already raised their hand).

```
┌──────────────────────────────────────────────────────┐
│  /host (or /manager) marketing landing page          │
│  - Hero: "Paste your Airbnb listing URL"             │
│  - Three-step explainer (audit / restyle / deliver)  │
│  - Pricing card: $79 Tune-Up / $129 Rush / $49 photo │
│  - "See a sample" CTA → /services/tune-up            │
└──────────────────────────────────────────────────────┘
   │
   │ host pastes Airbnb URL, clicks "Get free audit"
   ▼
┌──────────────────────────────────────────────────────┐
│  POST /api/self-serve { url }                        │
│  - middleware.ts captures restay_attr cookie (UTM,   │
│    30d, first-touch)                                 │
│  - validate Airbnb URL shape                         │
│  - dedupe by sourceId — return existing slug if     │
│    listing was already discovered                    │
│  - emit self-serve/submitted event with serviceId    │
│    inferred from referrer page                       │
└──────────────────────────────────────────────────────┘
   │
   ▼
[self-serve-ingest fn] fetchAirbnbListingDirect (no Apify — direct HTTP)
   ↓
- og:title, og:description, smartLocation, starRating, reviewCount,
  isSuperhost, coordinates, muscache CDN photos
- inserts listings row (source='self_serve', price=0 — filled by pricing later)
- emits listings/ingested
   ↓
qualification skips enrichment (host gave us their email at /host page already)
   ↓
preview generates one before/after pair within ~30s
   ↓
host lands on /l/[slug] with the audit + buy CTA
   ↓
   │ host clicks "Buy Tune-Up — {tuneupPrice}"
   ▼
┌──────────────────────────────────────────────────────┐
│  POST /api/checkout { listingId, serviceId, code? }  │
│  - resolve service by id (tune-up | rush | photo)    │
│  - Stripe Checkout Session (price = service.priceCents) │
│  - if code matches active promo, attach as discount  │
│  - Meta CAPI InitiateCheckout fires                  │
│  - 303 → checkout.stripe.com                         │
└──────────────────────────────────────────────────────┘
   │
   │ host pays
   ▼
┌──────────────────────────────────────────────────────┐
│  Stripe webhook checkout.session.completed           │
│  POST /api/stripe/webhook                            │
│  - verify signing secret                             │
│  - upsert orders row, status='paid'                  │
│  - backfill order.customerEmail from session         │
│  - emit orders/paid event                            │
│  - Meta CAPI Purchase fires                          │
└──────────────────────────────────────────────────────┘
   │
   ▼
[fulfillment fn] — heavy work, ~6–10 min total
   ↓
- mark order status='fulfilling'
- edit-photo loop (fal.ai per photo, with QC + 1 retry per photo)
- skip-and-refund auto-trigger if 50%+ photos fail QC twice
- rewriteListingCopy via Claude (title + description)
- computePricingRecommendation via comps async-poll (4-min budget)
- packageZip → upload to R2
- sign-gallery-urls + sign-zip-url (30-day TTL)
- send Email 5 (delivery)
- mark order status='fulfilled'
- track agent costs into agent_costs table
   ↓
host clicks {deliveryUrl} → /delivery/[orderId]
   ↓
┌──────────────────────────────────────────────────────┐
│  /delivery/[orderId]                                 │
│  - server-side gate: order.status === 'fulfilled'    │
│    AND order.customerEmail proves access (one-time   │
│    token query param OR Clerk-authed customer)       │
│  - shows: photo gallery (R2-signed thumbs + full),   │
│           rewritten title + description copy block,  │
│           pricing report card,                       │
│           zip download button,                       │
│           "Re-run with different style" support link │
└──────────────────────────────────────────────────────┘
```

## UI Flow 3 — Operator surfaces

```
/admin                      — funnel, deliverability, all-time totals, ad spend
/admin/outreach/[id]        — single outreach event timeline + reply thread
/admin/email/[resendId]     — single email rendered in sandboxed iframe
/admin/listings/[id]        — listing detail with qualification scores + photos
/admin/orders/[id]          — order status, refund button, deliverable preview
```

Operator-notify (Email 6) lands in `{repliesEmail}` for every classified inbound, and every row links back to these admin URLs — operator can read context without leaving their email client until they need to act.

---

## Promo code policy (`{promoCode}` defaults)

We don't currently run a continuous promo. The recommended pattern, mirrored from SiteGrid:

| Field | Value |
|---|---|
| Code | `FOUNDING50` |
| Discount | 25% off Tune-Up + Rush (NOT photo-only — too thin a margin) |
| Expiry | 7 days from first cold-outreach reply |
| Max redemptions | 100 |
| Stripe coupon | One-time, fixed pct |
| Activation | Auto-applied to checkout link in Email 2 only |

The discount lives in Stripe as a `coupon` + `promotion_code` pair so both the buy URL parameter (`?code=FOUNDING50`) and a manual entry on the Stripe checkout page work.

---

## Code gaps vs. this template

These exist in `inngest/functions/reply-handler.ts` and need to land before this doc is fully reflective of production:

1. **Decline auto-reply (Email 4)** — currently `reply-handler.ts:144-146` exits silently. Add a `sendDeclineReply()` step that sends Email 4.
2. **Operator-notify on every classification (Email 6)** — currently fires only for `complex` (`reply-handler.ts:114-141`). Move that step out of the `complex` branch so it runs after every classify call.
3. **Deterministic auto-reply templates** — `lib/claude.ts:draftAutoReply` LLM-drafts the price/style replies. Per SiteGrid's documented rule (and the same risk applies here: dropped checkout link, contradicted price, shifted tone), replace with the deterministic Email 2 + Email 3 templates above. Keep `classifyReply` as LLM (classification is a small enum, low surface area for hallucination).
4. **Founding-host promo wiring** — Email 2 references `{checkoutUrl}?code={promoCode}`. The Stripe checkout route at `/api/checkout` already supports `code`; verify the promo code exists in Stripe and the discount applies cleanly before Email 2 goes live.

Each of these is small and scoped; together they're ~150 lines of code change.

---

## Test plan

Run this checklist on a new merchant deployment, or after any change to outreach/reply/fulfillment, before sending real cold outreach.

### Pre-deploy

- [ ] Stripe live key set, webhook secret set, webhook endpoint pointed at `/api/stripe/webhook`
- [ ] Stripe coupon + promotion_code created (`{promoCode}` active, `{promoExpiryDays}` expiry, max_redemptions sane)
- [ ] Apify SCALE plan, billing-cycle headroom verified
- [ ] fal.ai key set, FAL_PREVIEW_MODEL set to flux-kontext (edit-only)
- [ ] OpenAI vision key set, OPENAI_VISION_MODEL set
- [ ] Anthropic key set, ANTHROPIC_MODEL set to claude-haiku-4-5
- [ ] Resend domain `mail.restay.agency` verified, inbound webhook endpoint pointed at `/api/resend/webhook`
- [ ] REPLIES_EMAIL env var set to operator inbox
- [ ] R2 bucket exists, public URL set, access key + secret correct
- [ ] Hunter.io API key set (optional but throughput suffers without it)
- [ ] Inngest event key + signing key set, `/api/inngest` returns `mode=cloud`
- [ ] Vercel SSO Protection disabled on production deployment
- [ ] All HTML emails have `<head><meta charset="utf-8">`

### Email 1 — cold outreach
- [ ] Trigger `discovery/manual` from /admin → wait 25 min for the cron to complete
- [ ] Confirm at least one new listings/ingested → qualified → preview/ready → outreach/sent chain in `outreach_events` table
- [ ] Pick a sent event, look up `resend_id`, view at `/admin/email/<resendId>`
- [ ] Verify subject matches `{listingShortAddress} — your free 60-second Airbnb audit`
- [ ] Verify before/after photos render, are watermarked, and link to the listing page
- [ ] Verify sender domain authenticates (no "via" text in Gmail)
- [ ] List-Unsubscribe header present, mailto + URL both work
- [ ] Click `{listingPageUrl}` → 200, listing page renders with audit findings + buy CTA
- [ ] Tracking pixel + click links fire (check `outreach_events` for `opened` / `clicked` after manually opening test email)

### Email 2 — auto-reply on price_question
- [ ] Reply to a test cold email with body `how much?` or `what's pricing on the rush version?`
- [ ] Within ~30 sec:
    - operator-notify (Email 6) lands in `{repliesEmail}`
    - rich auto-reply lands in test recipient inbox
    - subject = `Re: {original subject}`
    - discount-applied buy URL works (Stripe shows discounted total, NOT full price)
    - `{listingPageUrl}` link still works
    - `messages` table has both inbound + outbound rows linked to the listing
    - `outreach_events.status` flips to `replied`

### Email 3 — auto-reply on style_question
- [ ] Reply with body `do you actually edit the photos or is this a sample`
- [ ] Verify Email 3 fires with the EDITED / NOT EDITED bullet structure
- [ ] Confirm operator-notify Email 6 also fires

### Email 4 — graceful decline
- [ ] Reply with body `we're not interested` or `pass for now`
- [ ] Verify Email 4 fires (this is currently a code gap — see above)
- [ ] Confirm operator-notify Email 6 also fires

### Unsubscribe
- [ ] Reply with body `stop emailing me`
- [ ] Verify NO auto-reply lands (Email 2/3/4 should NOT fire)
- [ ] Verify operator-notify Email 6 still fires
- [ ] Verify the email is added to `admin_settings.email_blacklist`
- [ ] Verify the original outreach_event flips to status=`unsubscribed`
- [ ] Trigger another outreach cycle for the same listing — confirm it's skipped with reason `blacklisted`
- [ ] Hit `{unsubUrl}` directly → unsubscribe page confirms removal

### Complex flag
- [ ] Reply with a legal-sounding question or random rant
- [ ] Verify NO auto-reply fires
- [ ] Verify operator-notify Email 6 fires with `⚠️` prefix
- [ ] Verify `messages.humanFlag=true` is set on the inbound row

### Buy flow
- [ ] Hit `/l/<test-slug>` → 200, listing page with audit + photos + CTA
- [ ] Click "Buy Tune-Up — {tuneupPrice}" → 303 to Stripe with full price
- [ ] Hit `/l/<test-slug>?code={promoCode}` → checkout reflects discount
- [ ] Hit `/l/<bad-slug>` → 404
- [ ] Hit `/l/<unsubscribed-host-slug>` → audit page still works (we don't gate the public listing page on unsubscribe)

### Email 5 — fulfillment
- [ ] Pay through Stripe in live mode with a real card you'll refund (or test mode if available)
- [ ] Within ~10 min:
    - `orders.status` flips paid → fulfilling → fulfilled
    - all 10 photos restyled and uploaded to R2 (check `previews` + `orders.zipUrl`)
    - copy rewrite stored on the order
    - pricing report row exists with non-null `compMedianNightlyCents`
    - delivery email lands with download button visible (HTML render must show button, not raw URL)
    - Meta CAPI Purchase event fires (Events Manager → Test Events with META_TEST_EVENT_CODE)
- [ ] Click `{deliveryUrl}` → `/delivery/[orderId]` shows gallery + copy + pricing card + zip
- [ ] Click `{zipUrl}` directly → 200, downloads zip; confirm zip contains 10 jpgs + a `copy.txt` + a `pricing.json`
- [ ] Try `{deliveryUrl}` from an incognito browser without the token → 403 / sign-in gate

### Operator surfaces
- [ ] `/admin` (Clerk-gated) loads with funnel, deliverability, AllTimePanel, ResendPanel rows clickable through to email viewer
- [ ] `/admin/outreach/<id>` shows full conversation thread merged from outbound + inbound `messages` rows
- [ ] Operator-notify Email 6 fires for EVERY inbound classification (price_q, style_q, decline, unsubscribe, complex)
- [ ] `messages` table persists every inbound body in `bodyText` AND `bodyHtml`

### Status guard
- [ ] Manually set an `outreach_event` to status=`replied`, then have the tracking pixel fire (open the email again)
- [ ] Confirm status STAYS `replied` (a later open shouldn't downgrade an engaged lead)

### Discovery loop health
- [ ] `tri_angle/airbnb-scraper` runs visible at apify.com/runs after each cron tick
- [ ] No two-day silence — alert if a daily 13:00 UTC tick shows zero runs
- [ ] Apify monthly usage is under 75% of the SCALE plan budget at end-of-cycle

---

## When templatizing for another merchant in the same vertical family

Find-and-replace per merchant:

| Find | Replace with |
|---|---|
| `Restay` | new merchant brand name |
| `restay.agency` | new domain |
| `mail.restay.agency` | new send domain |
| `support@restay.agency` | new support email |
| `FOUNDING50` | new promo code |
| `$79` / `$129` / `$49` | new prices |
| `tri_angle/airbnb-scraper` actor | the scraper for the new platform (Vrbo / Booking / Hostelworld would each need their own actor + normalizer) |
| `Airbnb's listing-photo policy` | the host platform's equivalent edit-only constraint |

Keep these as-is across merchants:
- The 5-bucket classifier (price_question / style_question / decline / unsubscribe / complex)
- The Stripe webhook → fulfillment Inngest function → delivery email chain
- Operator-notify on every classification
- HMAC token model for unsub
- The "no downgrade" status guard on tracking pixels
- Charset declaration in every HTML email
- The async start + dataset-poll pattern for any scraper that crawls exhaustively
