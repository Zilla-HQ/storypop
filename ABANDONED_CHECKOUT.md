# ABANDONED_CHECKOUT.md — The 4-hour follow-up

A single human-tone email to customers who reached Stripe Checkout and stopped. No promo code. No automation tone. One per listing, ever.

## Why this exists

SiteGrid identified this pattern after Isabelle Tan @ Arash Law reached Stripe Checkout **nine times** without paying. Nine times. The cold-email loop had her tagged as "clicked" — but no follow-up was firing because she'd never replied.

A single direct email from the founder fixed it on visit 10. The lesson generalized: **mid-funnel abandonment is rarely about price**. It's almost always an unanswered question. The fix is to ask.

## What the cron does

`inngest/functions/abandoned-checkout.ts` runs hourly. Finds listings where:

- A `conversions` row with `event='checkout_started'` is older than `ABANDONED_CHECKOUT_DELAY_HOURS` (default 4).
- No prior `outreach_events` row with `template_id='abandoned_checkout'` exists.
- No `orders` row with `status IN ('paid', 'fulfilling', 'fulfilled')` exists.
- The listing has an `agentEmail`.

Sends a single email — same template every time — and writes a `template_id='abandoned_checkout'` row to `outreach_events` so it never re-fires for that listing.

## The email

The template is deliberately:

- **From the founder.** Set `FOUNDER_NAME` and `FOUNDER_REPLY_EMAIL` (defaults to `RESEND_REPLY_TO`).
- **Acknowledges the abandonment count.** "I noticed you opened the checkout 4 times" — using `count(conversions.id)` from the candidate query.
- **Three example concerns, then "or something else?"** — gives the customer language to use, without putting words in their mouth.
- **Offers a 10-minute Zoom.** Lowers the friction below the activation energy needed to reply with a typed question.
- **Plain text, no formatting.** Looks personal, not marketing.
- **No promo code.** Promo bombardment trains buyers not to pay full price.

Customize the body in `inngest/functions/abandoned-checkout.ts:renderBody()`.

## Vertical-aware concerns (optional, not in template default)

SiteGrid customizes the bullet list by vertical — restaurants worry about reservations breaking, healthcare about patient portals, legal about referral partners. The template ships a generic three-concern list; replace it per merchant:

```ts
function concernsFor(vertical: string | null): string[] {
  switch (vertical) {
    case "restaurants":
      return [
        `"How does the domain switch happen without breaking online reservations?"`,
        `"Will Google Business / Yelp / DoorDash links still resolve correctly?"`,
        `"I want a few menu sections rephrased before going live."`,
      ];
    case "healthcare":
      return [
        `"How does the domain switch happen without breaking patient bookings?"`,
        `"Do existing patient records / portal logins keep working?"`,
        `"Can I see the design on a few real pages before paying?"`,
      ];
    default:
      return [
        `"How does the domain switch work without breaking the existing site?"`,
        `"Can I see the design on a real custom domain before I commit?"`,
        `"I want to tweak a few sections first."`,
      ];
  }
}
```

The right concern in the right bullets makes the email feel addressed. The wrong concern reads like a form letter.

## Why this doesn't break the followup chain

The standard followup cron (`inngest/functions/followup.ts`) reads `outreach_events.templateId IN ('followup_v1')` for its idempotency check. The abandoned-checkout cron writes `template_id='abandoned_checkout'`, which the followup cron doesn't recognize, so a normal followup can still go out 72h after the original cold email — even if the customer hit checkout in between.

The two crons are deliberately decoupled. The abandoned-checkout email is a separate touch that runs orthogonal to the marketing cadence.

## Safety properties

- **Idempotent.** Re-running the cron after a successful send is a no-op (`template_id='abandoned_checkout'` row already exists).
- **Capped per run.** Default 10 sends per run; tune with `ABANDONED_CHECKOUT_MAX_PER_RUN`.
- **Respects pause.** If `adminSettings.paused=true`, the cron skips.

## Failure mode to watch

If your `conversions` table doesn't get a `checkout_started` event for every Stripe Checkout session, this cron will never fire. Make sure your `/api/checkout` handler writes:

```ts
await db.insert(conversions).values({
  listingId,
  event: "checkout_started",
  vertical: listing.vertical ?? undefined,
});
```

(Same pattern for `page_view`, `purchased`, etc — used by the weekly digest funnel report and the affiliate dashboard.)
