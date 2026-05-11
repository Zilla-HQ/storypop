# DIRECT_MAIL.md — Postcards via Lob

Physical 4x6 postcards mailed to qualified listings/customers. Per-piece billed (~$0.92 first-class). Budget-capped per-run and per-day. Idempotent: never re-mails the same listing.

## When to enable

- Email is saturated (deliverability has dropped, complaint rate is creeping up).
- You're CAC-positive on existing channels and want an additional touchpoint.
- Your unit economics support a $1–2 piece against your purchase price.
- You have a hero photo per recipient (the postcard's punch is the personalized front).

If those aren't true, the cron will run but it'll burn money. Keep `LOB_API_KEY` unset and the cron will no-op silently.

## Setup

1. **Sign up at Lob.com.** Free dev tier; production needs payment.

2. **Get an API key.** Lob dashboard → API keys.

3. **Set the envs:**

   ```bash
   LOB_API_KEY=live_xxx                # or test_xxx for dry-runs

   # Return address (printed on the back of every piece)
   LOB_FROM_NAME="Merchant Inc."
   LOB_FROM_LINE1="123 Main St"
   LOB_FROM_LINE2=                     # optional
   LOB_FROM_CITY="Brooklyn"
   LOB_FROM_STATE="NY"
   LOB_FROM_ZIP="11201"

   # Budget caps (defaults shown)
   DIRECT_MAIL_PER_RUN_CAP=20
   DIRECT_MAIL_DAILY_BUDGET_CENTS=5000
   DIRECT_MAIL_ASSUMED_COST_CENTS=100  # pre-flight estimate

   # Postcard copy
   POSTCARD_BRAND_NAME="Merchant"
   POSTCARD_CTA_TITLE="We made something for you."
   POSTCARD_CTA_BODY="Pulled from your real Google photos. Ready in 24 hours."
   POSTCARD_PRICE_LABEL="$199 once"    # optional pill at bottom
   ```

4. **Verify a return address.** Lob requires it before sending; do this in their dashboard once.

## Schedule

The cron runs weekday afternoons at 17:00 UTC (~1pm ET) — before Lob's same-business-day cutoff. The cron schedule is `0 17 * * 1-5`.

Override the schedule by editing `inngest/functions/direct-mail.ts`.

## Eligibility filter

Listings must:
- Have `qualified=true` (passed the qualification pipeline).
- Have a complete US address (`address`, `city`, `state`, `zip` all non-empty).
- NOT appear in `direct_mail_events` already (the `NOT IN` subquery against `direct_mail_events.listingId`).

The cron picks up to `DIRECT_MAIL_PER_RUN_CAP` rows ordered arbitrarily — first-discovered-first-mailed. Customize the ORDER BY in `direct-mail.ts` if you want priority by qualification score, recency, or anything else.

## What lands on the postcard

- **Front:** full-bleed photo (first item in `listings.photos`), darkened gradient on the bottom third, brand name + city overlay. If no photo, falls back to a slate gradient.
- **Back:** brand name (small caps), `POSTCARD_CTA_TITLE` (headline), `POSTCARD_CTA_BODY` (body), preview URL (`<APP_URL>/l/<slug>`), `POSTCARD_PRICE_LABEL` pill (if set).

Customize the HTML in `lib/lob-postcards.ts:renderPostcardFront` / `renderPostcardBack`. Lob renders at 4.25" x 6.25" with 0.125" bleed; the safe-zone for important content is the inner 4" x 6".

## Budget math

The cron computes today's spend by summing `direct_mail_events.costCents` for rows where `createdAt >= today`. If today's spend ≥ `DIRECT_MAIL_DAILY_BUDGET_CENTS`, the cron returns without sending.

Otherwise it computes `affordable = floor((dailyBudgetCents - spentToday) / DIRECT_MAIL_ASSUMED_COST_CENTS)` and caps the batch at `min(PER_RUN_CAP, affordable)`.

Inside the loop it tracks `runSpentCents` against the actual cost-per-piece Lob returns, so a piece that comes back at $1.20 (vs the $1.00 estimate) shortens the budget proportionally.

## Failed sends

A piece can fail for several reasons: invalid address shape, missing required field, Lob API error. The cron persists a `status='failed'` row with `error` in metadata so future runs skip the listing. The operator can clear failed rows manually after fixing the lead.

## Webhooks (optional)

Lob can webhook into `/api/webhooks/lob` on lifecycle events (rendered, in_transit, delivered, failed). Not wired by default — add when you want delivery-status visibility on `/admin/direct-mail`.

## What this doesn't do

- No personalized URL per recipient (everything goes to `/l/<slug>`). Adding QR codes per piece is straightforward — encode the slug + a tracking suffix.
- No A/B testing of front/back variants. Lob accepts variant IDs; the cron currently picks the single `renderPostcardFront/renderPostcardBack` output.
- No address validation pre-send. Lob's API will reject malformed addresses but won't catch "fake-looking but technically valid" entries.
