# Realscale: autonomous-merchant case study

| | |
|--|--|
| **Repo** | https://github.com/Zilla-HQ/realestate |
| **Site** | https://realscale.app — `/agents` (paid funnel) · `/renovate` (free funnel) |
| **Admin** | https://realscale.app/admin |

## Questions
## Responses

## Problem
We need a real, revenue-producing merchant on the Zilla platform to validate that the three-layer framework actually compounds. A spec or prototype isn't enough — the merchant has to be cold-discovering customers, taking live payments, fulfilling, and surviving CAN-SPAM / NAR / TCPA constraints, all without a human on the loop.

## Proposal
Realscale.app — an AI real-estate photo-enhancement merchant running as a fully autonomous business that will do everything legally permissible to generate revenue. Two funnels share one backend:

- **Agents (paid)**: $89 standard / $138 + twilight / $149 rush. A 6h cron scrapes Zillow + Redfin + Realtor, qualifies on photo-quality + agent-value scores, generates a free personalized preview, cold-emails the listing agent with the before/after, takes Stripe payment, fulfills, delivers a watermarked ("Virtually Staged" per NAR) zip.
- **Homeowners (free + referral)**: $0. Homeowner submits address; pool/solar/curb-appeal mockup runs over a Mapbox satellite tile; if they want it built, the agent finds the top Yelp contractors, auto-discovers each one's email (Yelp profile → website link → scrape; fallback Apify Google search → scrape), cold-emails each contractor the lead details + $150 referral terms. Operator never touches contractor outreach.

Anyone who lands organically is funneled by intent within one click — `/agents` for "I sell homes", `/renovate` for "I own a home" — into the same backend.

## Integrations (every API and what it does)
**Hosting + data** — Vercel (deploy + DNS + auto-DNS for Resend records); Supabase Postgres + Drizzle ORM; Cloudflare R2 (renders + delivery zips, S3-compatible); Inngest Cloud (durable workflows, cron + event, step retries, fan-out); Clerk (admin auth); PostHog (product analytics).

**Agent skills** — Apify (Zillow / Redfin / Realtor scrapers + Google Search scraper for contractor email discovery, all via REST since the SDK's `proxy-agent` dep doesn't survive Vercel bundling); fal.ai FLUX.1 Kontext (image-to-image edit preserving source geometry — picked over nano-banana which kept inventing different rooms); Mapbox (geocoding + static satellite tile for pool/solar mockups); Anthropic Claude (Haiku for email drafting + reply triage; Sonnet vision for photo QC + sample validation); Yelp Fusion (top-rated local contractors by category + zip); MJML + Sharp (email templating with auto-injected CAN-SPAM footer; SVG-overlay "Virtually Staged" disclosure); Archiver (zip generation).

**Communications + payments** — Resend (outbound email; verified `mail.realscale.app` subdomain with DKIM + SPF; inbound webhook for replies with open/click tracking); ImprovMX (silent forwarder so `replies@realscale.app` lands in the operator inbox without exposing the operator's domain); Stripe (Checkout in live mode + signed webhook for `checkout.session.completed → orders/paid`).

**Configured but constrained** — **Lob (postcard mailer)** — wired and gated behind admin `mailer_enabled` flag; can't ship until a verified return-to-sender address is registered (USPS / Lob requirement on every piece of mail). **Twilio (SMS)** — keys saved, behind a hard-coded TCPA consent gate; can't ship until A2P 10DLC registration completes (carriers require business tax ID + EIN + verified entity info before any commercial SMS will deliver, US-wide).

## Manual vs autonomous setup

**Required a human (one-time, ~2 hours total)** — buying realscale.app and pointing DNS at Vercel; pasting each provider's API key into Vercel env (Stripe live, Resend, Apify, fal.ai, Anthropic, Yelp, Mapbox, Lob, R2); clicking "Verify domain" in Resend after the Vercel-Resend integration auto-added DKIM/SPF; flipping Stripe to live mode + creating the webhook endpoint; allow-listing the operator email in Clerk; setting `senderDomains = ["mail.realscale.app"]` in admin settings; setting `BUSINESS_ADDRESS` env var for the CAN-SPAM footer.

**Runs without a human** — 6h discovery cron → photo-vision qualification → preview generation → cold email with personalized before/after → 72h follow-up with a discount code → inbound reply classification (unsubscribe / price / style / decline / complex) → auto-reply for the easy ones, flag-for-human for complex; post-payment: fulfillment fans out per-photo edits with QC retries, watermarks, zips, emails delivery; homeowner side: lead form fires `lead/captured` → Yelp match → auto-discover contractor email → cold-email contractor with referral terms → confirm to homeowner. Every send writes to `outreach_events` with open/click/reply tracking from the Resend webhook.

## Why we built it
Realscale exercises every primitive a future merchant will need (input capture, gated checkout, hosted artifact, customer inbox, recipient inbox, partner-side outreach), every agent skill (scrape, generate-image, write-copy, fill-template, send-email, find-email, verify-artifact), and every platform service (hosting, scheduler, payments, sender reputation, observability). It also stress-tests the autonomous-revenue claim under real legal pressure: CAN-SPAM forces verified sender + physical-address footer + one-click unsubscribe; NAR forces a "Virtually Staged" stamp on every delivered photo; TCPA forces SMS-only-after-consent. The platform can't honestly ship a second autonomous merchant if it can't enforce these by default for everyone.

## Testing the business
Three loops run concurrently and are observable end-to-end in `/admin`:

- **Cold loop** — discovery cron + qualification metrics on `/admin/listings`, every send body + opened-at + clicked-at + replied-at on `/admin/outreach`, full conversation thread merged across cold + follow-up + inbound reply + auto-reply per listing.
- **Self-serve loop** — homeowner submits an address, watch `/generating/<id>` flip to `/l/<slug>` once preview ready, contractor matching audit on `/admin/leads` (rank, rating, discovered email, intro status).
- **Order loop** — Stripe Checkout → fulfillment → delivery email + zip on `/admin/orders`.

Readiness checklist on `/admin` probes every env var + admin flag the autonomous loop touches; the contacts directory lists every realtor + homeowner contacted with sent/opened/clicked/replied roll-ups, so we can tell within minutes whether the business is producing or stuck.

## Productizing this as the merchant template
Every layer of Realscale is built as a reusable primitive, not a real-estate-specific feature: `outreach_events` is a generic "any cold or transactional send to any recipient" log; the Inngest event schema (`*/qualified`, `lead/captured`, `orders/paid`, `inbound/email`) is merchant-agnostic; `sendComplianceEmail` enforces CAN-SPAM for every future merchant by default (no bypass); contractor discovery is "given an entity, find their email" and works for any partner type. To stand up merchant #2, the steps are: (1) define the merchant's input shape (one schema), (2) drop in the merchant's generation prompt + service catalog, (3) point discovery at the new source, (4) wire one new payment branch if pricing differs. No new platform work — everything that wasn't real-estate-specific is already platform code.

The single biggest open platform decision: standardize on **Vercel + Inngest as the workflow runtime for every Zilla merchant**. Inngest already auto-syncs functions on Vercel deploy, gives you cron + event triggers + step idempotency + retries + concurrency caps for free. Locking it in means every merchant's agent code looks identical structurally; the cost of merchant N+1 is config, not infra.

## What can go wrong
Cold sender reputation is built per-domain — one bad merchant's send (broken footer, deceptive subject, looks too templated) damages every future merchant on the same parent domain. Mitigation: per-merchant subdomains, list hygiene, the readiness checklist as a hard gate before any send.

The "wiring existing primitives" thesis breaks on per-vertical compliance — NAR for real estate, FINRA for advisors, HIPAA for medical, FTC for affiliate. Each is platform-level, not merchant-level. Pretending otherwise will make merchant #2 rebuild merchant #1's compliance plumbing.

The contractor side fails to monetize until Stripe Connect lands — Yelp gives us search but no payouts; the agent can find emails and intro the lead, but we can't actually collect the $150 referral fee programmatically until contractors can pay us through a portal. Until then, referral collection is invoice-by-invoice, which doesn't compound.
