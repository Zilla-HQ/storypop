# Realscale: autonomous-merchant case study

| | |
|--|--|
| **Repo** | https://github.com/Zilla-HQ/realestate |
| **Site** | https://realscale.app — agent funnel `/agents` · homeowner funnel `/renovate` |
| **Admin** | https://realscale.app/admin (Clerk-gated) |

## Questions
## Responses

## Problem
We need a real, revenue-producing merchant running on the Zilla platform to validate that the three-layer framework actually compounds. A spec or a prototype isn't enough — the merchant has to be cold-discovering customers, taking live payments, fulfilling, and surviving CAN-SPAM / NAR / TCPA constraints, all without a human sitting on the loop.

## Proposal
Build Realscale.app: an AI real-estate photo-enhancement merchant that runs as a fully autonomous business and will do everything legally permissible to generate revenue. Two funnels share one backend:

- **Agents (paid)**: $89 standard / $138 + twilight / $149 rush. Cold cron scrapes Zillow + Redfin + Realtor every 6h, qualifies on photo-quality + agent-value scores, generates a free personalized preview, cold-emails the listing agent with the before/after, takes payment via Stripe, fulfills, delivers a watermarked ("Virtually Staged" per NAR) zip.
- **Homeowners (free + referral)**: $0 — homeowner submits address; pool/solar/curb-appeal mockup runs over a Mapbox satellite tile; if they like it, Yelp Fusion picks the top-rated local contractors and we collect a referral fee.

Anyone who lands organically on realscale.app is funneled into the right loop within one click — `/agents` for "I sell homes", `/renovate` for "I own a home" — and reaches the same backend.

## What's running (APIs and what each does)

**Platform services** — Vercel (hosting + DNS + auto-sync of Resend records); Supabase Postgres + Drizzle ORM; Inngest Cloud (durable workflow runtime, cron + event); Clerk (admin auth); PostHog (product analytics); Cloudflare R2 (object store for renders + delivery zips, S3-compatible).

**Agent skills** — Apify (Zillow / Redfin / Realtor scrapers via REST, not SDK — apify-client's `proxy-agent` dep doesn't survive Vercel bundling); fal.ai FLUX.1 Kontext (image-to-image edit preserving source geometry, picked over nano-banana which kept inventing different rooms); Mapbox (geocoding + static satellite tile for pool/solar mockups); Anthropic Claude (Haiku for email drafting + reply triage; Sonnet vision for photo QC + sample validation); MJML + Sharp (email templating with auto-injected CAN-SPAM footer; SVG-overlay disclosure watermark); Archiver (zip generation).

**Communications** — Resend (outbound email; verified `mail.realscale.app` subdomain with DKIM + SPF; inbound webhook for replies); ImprovMX (silent forwarder so `replies@realscale.app` lands in the operator inbox without exposing the operator's domain); Stripe (Checkout in live mode + signed webhook for `checkout.session.completed → orders/paid`); Yelp Fusion (contractor lookup by category + zip — keys live, matching agent partial).

**Configured but not yet active** — Lob (postcard mailer; test key wired, behind admin `mailer_enabled` flag, **needs a real return-to-sender address before it can mail**); Twilio (SMS only after explicit TCPA consent — keys saved but A2P 10DLC registration not done, so no SMS goes out yet).

## What was manual vs autonomous

**Required a human (one-time)** — buying realscale.app and pointing DNS at Vercel; pasting each provider's API key into Vercel; clicking "Verify domain" in Resend after Vercel-Resend auto-added the DKIM/SPF records; flipping Stripe to live mode and creating the webhook endpoint; allow-listing the operator email in Clerk; updating `senderDomains` in admin settings to `["mail.realscale.app"]`.

**Runs without a human** — 6-hour discovery cron → photo-vision qualification → preview generation → cold email with personalized before/after → 72h follow-up with discount code → inbound reply classification (unsubscribe / price / style / decline / complex) → auto-reply for the easy ones, flag-for-human for complex; post-payment: fulfillment fans out per-photo edits with QC retries, watermarks, zips, emails delivery; every send writes to `outreach_events` with open/click/reply tracking via Resend webhook.

## Admin dashboard
`/admin` surfaces: a 15-item readiness checklist (every env var + flag the autonomous loop touches); listings with qualification scores; **outreach with full email body, opened-at, clicked-at, replied-at, plus a per-listing thread view that merges cold sends, follow-ups, inbound replies, and auto-replies**; a contacts directory (every realtor and every homeowner contacted, with sent/opened/clicked/replied roll-ups); orders + postcard previews + lead capture + settings.

## What's enabled now vs what to add
**On now** — discovery, qualification, preview, agent cold outreach, follow-up, reply triage, Stripe payments, fulfillment + delivery, admin email log.
**Add next** — Yelp matching agent (lib done, Inngest function not wired); contractor portal + Stripe Connect for referral payouts; Lob postcard send (after return-address); Twilio SMS (after A2P registration); Vercel Ads / Meta paid acquisition layer to compound on top of cold + organic.

A worth-considering platform add: **Vercel Inngest integration as a first-class platform service** — every Zilla merchant will need durable workflows with retries, crons, fan-out, and step-level idempotency, and Inngest already auto-syncs functions on Vercel deploy. Standardize on it instead of letting each merchant pick its own.

## Why
Realscale exercises every primitive a future merchant will need (input capture, gated checkout, hosted artifact, customer inbox, recipient inbox), every agent skill (scrape, generate-image, write-copy, fill-template, send-email, verify-artifact), and every platform service (hosting, scheduler, payments, sender reputation, observability). When the next merchant ships, the question isn't "what do we build" but "which primitives do we re-wire."

It also stress-tests the autonomous-revenue claim under real legal pressure: CAN-SPAM forces verified sender + physical-address footer + one-click unsubscribe; NAR forces a stamped "Virtually Staged" disclosure on every delivered photo; TCPA forces SMS-only-after-consent. The merchant can't ship if the platform can't enforce these for every future merchant by default.

## What can go wrong
Cold outreach gets the sender domain throttled or block-listed — `mail.realscale.app` is verified but reputation is built per-domain, and one bad send (footer misconfig, broken unsubscribe, looking too templated) damages every future merchant on the same parent domain. Mitigation: per-merchant subdomains, list hygiene, and the readiness checklist.

The contractor side fails to monetize — Yelp gives us search but no payouts; without Stripe Connect + a contractor-facing portal, every "free" homeowner mockup is a cost center, not revenue. Mitigation: ship the matching agent + payout rails next, gate homeowner generation on a contractor-side fee model, or add a low-priced add-on.

The "wiring existing primitives" thesis breaks on per-vertical compliance — NAR for real estate, FINRA for advisors, HIPAA for medical, FTC for affiliate. Each is platform-level, not merchant-level, and pretending otherwise will make the second merchant rebuild the first merchant's compliance plumbing.
