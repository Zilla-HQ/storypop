# Relist

A 100% agent-run real estate photo enhancement SaaS. Six Inngest-driven agents scrape new US listings, score them, generate AI before/afters, email listing agents a personalized preview with a Stripe checkout link, and fulfill paid orders end-to-end via a staging API. Zero humans in the fulfillment loop.

```
Discovery → Qualification → Preview → Outreach → [Payment] → Fulfillment → Delivery
                                              ↘  Follow-up (72h)  ↘  Reply-handler
```

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui |
| Database | Supabase Postgres + Drizzle ORM (postgres-js driver) |
| Workflows | Inngest (cron + event-driven) |
| Admin auth | Clerk (email-allowlisted) |
| Payments | Stripe Checkout + webhooks |
| Email | Resend (+ inbound webhook) |
| SMS | Twilio (post-engagement only) |
| Storage | Cloudflare R2 |
| Scraping | Apify (Zillow / Redfin / Realtor) |
| Preview gen | fal.ai Nano Banana Pro |
| Paid fulfillment | REimagineHome (swappable — see `lib/staging-api.ts`) |
| LLMs | Anthropic Claude Haiku + OpenAI GPT-4o-mini |
| Analytics | PostHog |

---

## Local development

```bash
# 1. Install deps (npm, pnpm, or yarn — all work; lockfile is npm by default)
npm install

# 2. Copy env, fill in keys (see "First-time setup" below for the checklist)
cp .env.example .env.local

# 3. Push the schema to Neon
npm run db:push

# 4. Run the app
npm run dev          # http://localhost:3000

# 5. In a separate terminal, run Inngest dev server
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open http://localhost:8288 for the Inngest dashboard — you can manually trigger any function.

---

## First-time setup (you, Jack — manual steps)

1. **Domains** — register `relist.ai` + one backup. Warm sender subdomains on Instantly for 14 days.
2. **LLC + bank** — Delaware LLC, Mercury account.
3. **Stripe** — activate live mode, configure tax, add webhook endpoint → `POST /api/stripe/webhook` with `checkout.session.completed` + `charge.refunded`.
4. **Neon** — create project, paste pooled `DATABASE_URL` into env.
5. **Clerk** — create app, allowlist `ADMIN_EMAIL` only. No public signups.
6. **Apify** — sign up, fund actor runs, set `APIFY_TOKEN`. Defaults point at public actors — swap to private rentals if you hit rate limits.
7. **fal.ai** — API key, verify Nano Banana Pro access.
8. **REimagineHome** — pilot plan, API key. (Alternative: `Virtual Staging AI` — swap implementation in `lib/staging-api.ts` and set `STAGING_PROVIDER`.)
9. **Resend** — add each sender subdomain, configure DKIM/SPF/DMARC. Enable inbound webhook → `POST /api/resend/webhook`. Signing secret in `RESEND_INBOUND_WEBHOOK_SECRET`.
10. **R2** — create bucket `relist-photos`. Generate API token with read/write. Optionally attach a public domain for gallery images (`R2_PUBLIC_URL`).
11. **Twilio** — only needed for rush-tier delivery SMS. Buy a number.
12. **PostHog** — create project, set `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_PROJECT_API_KEY`.

---

## Deploying

1. **Vercel** — push to GitHub, import, paste env vars. Framework preset = Next.js.
2. **Inngest Cloud** — Create app, sync the `/api/inngest` endpoint URL from Vercel. Set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` in Vercel. Run a manual `discovery` invocation to verify all 6 functions register.
3. **Stripe** — switch webhook endpoint to the Vercel URL; rotate `STRIPE_WEBHOOK_SECRET`.
4. **Resend** — switch webhook URL.

---

## Happy-path test

With all env set, Neon pushed, and `npm run dev` running plus Inngest dev:

```bash
# 1. Seed a listing manually (edit or replicate this script):
npx tsx --env-file=.env.local scripts/seed-listing.ts --email you+test@yourdomain.com
# → prints listingId

# 2. Trigger qualification via Inngest dev UI:
#    event: listings/ingested  data: {"listingId":"<id>","source":"zillow"}

# 3. Watch the chain fire:
#    listings/ingested → listings/qualified → preview/ready → outreach/sent
#    (email arrives at the address you seeded)

# 4. Click the email → lands on /l/<slug> → click "Choose Standard"
#    → Stripe test card 4242 4242 4242 4242, any future exp, any CVC
#    → redirects to /delivery/<orderId>

# 5. Stripe webhook fires orders/paid → fulfillment runs → delivery email
#    arrives + /delivery/<orderId> populates with enhanced photos + zip link.
```

---

## Ops runbook

### Pausing a campaign
Admin dashboard → "Campaign controls". Each agent has its own pause toggle plus a global pause. Paused agents emit `skipped: paused` and do nothing; in-flight runs finish.

### Refunding an order
Admin → Orders → click "Refund" next to the row. Calls `stripe.refunds.create` and marks the row `refunded`. Auto-refund also triggers from fulfillment when fewer than 8 photos pass QC.

### Domain went hot (complaints > 0.3%)
The outreach agent auto-halts at 0.3% 24h complaint rate. Admin → Dashboard → Deliverability panel. Remove the domain from `SENDER_DOMAINS` and re-seed settings, or manually blacklist the bad subdomain.

### Blacklisting an agent / brokerage
Admin → Listings → find the row. (Direct DB edit for now — paste into `admin_settings.email_blacklist` or `admin_settings.brokerage_blacklist` jsonb.) A UI for this lives in the settings page TODO.

### Killing a bad cron run
Inngest Cloud → function → run → "Cancel run". Will not un-send emails that already landed in Resend — those drop through. Rely on the daily send cap as your guardrail.

---

## Hardcoded compliance guardrails (do not remove)

1. **CAN-SPAM footer** — `lib/resend.ts` auto-injects physical address + unsubscribe link on every outbound email. There is no raw-send helper.
2. **TCPA SMS gate** — `lib/twilio.ts` throws unless the contact has replied to an email or started a Stripe Checkout. A click alone is not consent.
3. **NAR virtual staging disclosure** — `inngest/functions/fulfillment.ts` stamps "Virtually Staged" on every staged photo before delivery.
4. **Apify-only scraping** — 1 call per source per 6h cron. No direct Zillow/Redfin/Realtor scraping.

---

## File tour

```
app/(marketing)   — Landing, /l/[slug], /checkout, /delivery
app/admin         — Dashboard, listings, outreach, orders, settings (Clerk-gated)
app/api/*         — checkout, stripe webhook, resend webhook, inngest serve
db/               — Drizzle schema + Neon client + settings helper
inngest/client.ts — Typed event schemas
inngest/functions — 6 agents + reply handler
lib/apify.ts      — Apify wrappers + normalizers
lib/falai.ts      — Preview generation (Nano Banana Pro)
lib/staging-api.ts — Paid-tier provider (REimagineHome, swappable)
lib/vision.ts     — Photo scoring + QC vision gate (GPT-4o-mini)
lib/claude.ts     — Email drafting + reply classification (Haiku)
lib/resend.ts     — CAN-SPAM-wrapped email send
lib/twilio.ts     — TCPA-gated SMS send
lib/r2.ts         — R2 upload + signed URLs
lib/watermark.ts  — Sharp-based text watermark (preview + NAR disclosure)
lib/scoring.ts    — Agent-value heuristic + qualification thresholds
lib/costs.ts      — Daily per-agent cost tracker
```
