# Realscale: autonomous-merchant case study

| | |
|--|--|
| **Repo** | https://github.com/Zilla-HQ/realestate |
| **Site** | https://realscale.app — `/agents` (paid funnel) · `/renovate` (free funnel) |
| **Admin** | https://realscale.app/admin |

## Questions
## Responses

## Problem
We need a real, revenue-producing merchant on the Zilla platform to validate that the three-layer framework actually compounds. A spec or prototype isn't enough — the merchant has to be cold-discovering customers on both sides of a two-sided marketplace, taking live payments, fulfilling, and surviving CAN-SPAM / NAR / CCPA / TCPA constraints, all without a human on the loop.

## Proposal
Realscale.app — an AI real-estate photo-enhancement merchant running as a fully autonomous business that will do everything legally permissible to generate revenue. Two symmetric funnels share one backend:

- **Agents (paid)** — $89 standard / $138 + twilight / $149 rush. A 6h cron scrapes Zillow + Redfin + Realtor MLS data, qualifies on photo-quality + agent-value scores, generates a free personalized preview, cold-emails the listing agent the before/after, takes Stripe payment, fulfills, delivers a watermarked ("Virtually Staged" per NAR) zip.
- **Homeowners (free + referral)** — $0. A separate 12h cron pulls owner-of-record property records from county tax + ATTOM / PropertyRadar, filtered by service-fit (lot >¼ acre with no pool → pool targets; living area >1,500 sqft → solar targets; bare front yard → curb-appeal targets). Skiptracing (Apollo / Hunter over the owner's name + zip) resolves an email, which is then run through CCPA/CPA opt-out checks. The same Mapbox satellite + fal.ai mockup pipeline runs against the property, then we cold-email the homeowner a personalized "your home with a pool" preview. If they engage, the agent finds the top Yelp contractors, auto-discovers each contractor's email (Yelp profile → website link → scrape; fallback Apify Google search → scrape), and cold-emails each contractor the lead details + $150 referral terms — operator never touches contractor outreach. Inbound submissions via `/renovate` flow through the same backend.

Anyone who lands organically is funneled by intent within one click — `/agents` for "I sell homes", `/renovate` for "I own a home" — into the same pipeline.

## Integrations (every API and what it does)

**Hosting + data**
- **Vercel** — deploy + DNS + auto-DNS for Resend records
- **Supabase Postgres + Drizzle ORM** — primary datastore, type-safe queries
- **Cloudflare R2** — renders + delivery zips, S3-compatible storage
- **Inngest Cloud** — durable workflows; cron + event; step retries, fan-out, idempotency
- **Clerk** — admin auth (email allowlist)
- **PostHog** — product analytics + funnel attribution

**Discovery + enrichment**
- **Apify** — Zillow / Redfin / Realtor MLS scrapers + Google Search scraper for contractor email discovery (REST, not SDK — `proxy-agent` doesn't survive Vercel bundling)
- **ATTOM Data API** — national property records (owner of record, lot size, pool flag, year built)
- **PropertyRadar API** — richer property filters, owner-occupancy flag, paid tier
- **Apollo.io** — people enrichment / skiptracing (homeowner name + zip → email)
- **Hunter.io** — people-search fallback for skiptracing
- **Yelp Fusion** — top-rated local contractors by category + zip
- **Mapbox** — geocoding + static satellite tile for pool/solar mockups

**Generation + QC**
- **fal.ai FLUX.1 Kontext** — image-to-image edit preserving source geometry (picked over nano-banana, which kept inventing different rooms)
- **Anthropic Claude** — Haiku for email drafting + reply triage; Sonnet vision for photo QC + sample validation
- **OpenAI** — SDK + `OPENAI_API_KEY` wired as a secondary-LLM fallback; production request path is Claude-only today, OpenAI is reserved for offline QA / repro scripts
- **Sharp** — SVG-overlay "Virtually Staged" disclosure watermark
- **Archiver** — zip generation for delivery

**Communications + payments**
- **Resend** — outbound email; verified `mail.realscale.app` with DKIM + SPF; inbound webhook for replies + open/click/reply tracking
- **MJML** — email templating with auto-injected CAN-SPAM footer + one-click unsubscribe
- **ImprovMX** — silent forwarder so `replies@realscale.app` lands in the operator inbox without exposing the operator's domain
- **Stripe** — Checkout in live mode + signed webhook for `checkout.session.completed → orders/paid`

**Configured but constrained**
- **Lob (postcards)** — wired and gated behind admin `mailer_enabled` flag; can't ship until a verified return-to-sender address is registered (USPS/Lob requirement on every piece of mail)
- **Twilio (SMS)** — keys saved, behind a hard-coded TCPA consent gate; can't ship until A2P 10DLC registration completes (carriers require business tax ID + EIN + verified entity info before any commercial SMS will deliver)

## Manual vs autonomous setup

**Required a human (one-time, ~2 hours total)**
- Bought realscale.app and pointed DNS at Vercel
- Pasted each provider's API key into Vercel env: Stripe live, Resend, Apify, fal.ai, Anthropic, Yelp, Mapbox, Lob, R2, ATTOM, PropertyRadar, Apollo, Hunter
- Clicked "Verify domain" in Resend (Vercel-Resend integration auto-added DKIM/SPF)
- Flipped Stripe to live mode + created the webhook endpoint
- Allow-listed the operator email in Clerk
- Set `senderDomains = ["mail.realscale.app"]` in admin settings
- Set `BUSINESS_ADDRESS` env var (CAN-SPAM footer)
- Set `HOMEOWNER_DISCOVERY_ZIPS` so the homeowner cron knows which markets to target

**Runs without a human**
- 6h realtor discovery cron + 12h homeowner discovery cron
- Photo-vision qualification (per-listing scoring + service-fit filter)
- Preview generation (fal.ai Kontext on MLS photos or Mapbox tiles)
- Cold email with personalized before/after — agent or homeowner copy depending on source
- 72h follow-up with discount code
- Inbound reply classification: unsubscribe / price / style / decline / complex → auto-reply or flag for human
- Post-payment fulfillment: per-photo edits with QC retries → watermark → zip → delivery email
- Lead form fires `lead/captured` → Yelp match → auto-discover contractor email → cold-email contractor with referral terms → confirm to homeowner
- Every send writes to `outreach_events` with open/click/reply tracking via Resend webhook
- Every homeowner cold-target passes a state-level opt-out check before any send

## Why we built it

Realscale exercises every primitive a future merchant will need:

- **Product primitives** — input capture, gated checkout, hosted artifact, customer inbox, recipient inbox, partner-side outreach
- **Agent skills** — scrape, skiptrace, generate-image, write-copy, fill-template, send-email, find-email, verify-artifact
- **Platform services** — hosting, scheduler, payments, sender reputation, observability, opt-out registry

It also stress-tests the autonomous-revenue claim under real legal pressure:

- **CAN-SPAM** — verified sender + physical-address footer + one-click unsubscribe
- **CCPA / CPA** — Do-Not-Sell mechanism for residential cold-emails
- **NAR** — "Virtually Staged" stamp on every delivered photo
- **TCPA** — SMS-only-after-consent

The platform can't honestly ship a second autonomous merchant if it can't enforce these by default for everyone.

## Testing the business

Three loops run concurrently and are observable end-to-end in `/admin`:

- **Cold loop (both sides)** — `/admin/listings` shows discovery cron output + qualification metrics; `/admin/outreach` shows every send body + opened-at + clicked-at + replied-at, plus a full conversation thread merged across cold + follow-up + inbound reply + auto-reply per listing; `/admin/contacts` rolls up sent/opened/clicked/replied per realtor and per homeowner
- **Self-serve loop** — homeowner submits address → `/generating/<id>` flips to `/l/<slug>` once preview ready → `/admin/leads` audits the contractor matching (rank, rating, discovered email, intro status)
- **Order loop** — Stripe Checkout → fulfillment → delivery email + zip on `/admin/orders`

Readiness checklist on `/admin` probes every env var + admin flag the autonomous loop touches; we can tell within minutes whether the business is producing or stuck.

## Productizing this as the merchant template

Every layer of Realscale is built as a reusable primitive, not a real-estate-specific feature:

- `outreach_events` is a generic "any cold or transactional send to any recipient" log
- Inngest event schema (`*/qualified`, `lead/captured`, `orders/paid`, `inbound/email`) is merchant-agnostic
- `sendComplianceEmail` enforces CAN-SPAM for every future merchant by default (no bypass)
- Discovery is "pull entities from a source, qualify, enrich, contact" — works for any vertical
- Skiptracing + opt-out are platform services any merchant can call

To stand up merchant #2:

1. Define the merchant's input shape (one schema)
2. Drop in the merchant's generation prompt + service catalog
3. Point discovery at the new source(s)
4. Wire one new payment branch if pricing differs

No new platform work — everything that wasn't real-estate-specific is already platform code.

The single biggest open platform decision: standardize on **Vercel + Inngest as the workflow runtime for every Zilla merchant**. Inngest already auto-syncs functions on Vercel deploy and gives you cron + event triggers + step idempotency + retries + concurrency caps for free. Locking it in means every merchant's agent code looks identical structurally; the cost of merchant N+1 is config, not infra.

## What can go wrong

- **Sender reputation is per-domain** — one bad merchant's send (broken footer, deceptive subject, looks too templated) damages every future merchant on the same parent domain. Mitigation: per-merchant subdomains, list hygiene, the readiness checklist as a hard gate before any send, plus the daily-send cap + complaint-rate kill-switch already wired into outreach.
- **Per-vertical compliance** breaks the "wiring existing primitives" thesis — NAR for real estate, FINRA for advisors, HIPAA for medical, FTC for affiliate. Each is platform-level, not merchant-level. Pretending otherwise will make merchant #2 rebuild merchant #1's compliance plumbing.
- **Contractor side won't monetize until Stripe Connect lands** — Yelp gives us search but no payouts. The agent finds emails and intros leads, but we can't collect the $150 referral fee programmatically until contractors pay us through a portal. Until then, referral collection is invoice-by-invoice, which doesn't compound.
- **Skiptrace accuracy is the soft underbelly of homeowner cold** — Apollo + Hunter give us emails but not all are deliverable. The CAN-SPAM / CCPA infra is on the right side of the law for what we send, but a high bounce rate damages domain reputation. Mitigation: confidence scoring on every skiptraced email + bounce-rate kill-switch + per-source quality monitoring.
