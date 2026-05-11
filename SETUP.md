# Setup — 30-minute walkthrough

From "I just clicked Use this template" to "live cold-outreach". Work top-to-bottom.

---

## 0. Prereqs (~5 min)

- [ ] Node 20+ and `pnpm` (or npm) locally
- [ ] [Vercel CLI](https://vercel.com/cli) installed and logged in (`vercel login`)
- [ ] [GitHub CLI](https://cli.github.com) optional, for repo automation
- [ ] A credit card for the few paid services in this list (most have free tiers)

---

## 1. Fork the template (~1 min)

Click **"Use this template"** on the [merchant-template](https://github.com/Zilla-HQ/merchant-template) repo page → create a new repo (e.g. `Zilla-HQ/my-merchant`). Clone it locally:

```bash
git clone https://github.com/Zilla-HQ/<your-merchant>.git
cd <your-merchant>
pnpm install
```

---

## 2. Provision the platform services (~15 min)

You don't need to write anything yet — just sign up for accounts and grab the keys.

### Required (everything below is needed for any merchant)

| Provider | What it does | Sign-up | Free tier? |
|---|---|---|---|
| **Vercel** | Hosting + DNS + auto-DNS for Resend records | https://vercel.com | yes |
| **Supabase** | Postgres database | https://supabase.com | yes |
| **Cloudflare R2** | Object storage for renders + delivery zips | https://dash.cloudflare.com → R2 | 10 GB free |
| **Inngest Cloud** | Workflow runtime (cron + events) | https://app.inngest.com | yes |
| **Clerk** | Admin auth | https://clerk.com | yes |
| **PostHog** | Product analytics | https://posthog.com | yes |
| **Stripe** | Payments + webhooks | https://stripe.com | yes (test mode) |
| **Resend** | Outbound + inbound email | https://resend.com | 100/day free |
| **Anthropic** | Claude (email drafting + reply triage + vision QC) | https://console.anthropic.com | pay-as-you-go |

### Generation provider (pick what your merchant needs)

| Provider | What it does | Free tier? |
|---|---|---|
| **fal.ai** | Image-to-image edits (FLUX.1 Kontext) | $5 free credits |
| **Mapbox** | Geocoding + satellite tiles (only if any service uses `imageSource: "satellite_tile"`) | 100k tiles/mo free |

### Discovery + enrichment (only if doing cold outreach)

| Provider | What it does | Free tier? |
|---|---|---|
| **Apify** | Scrapers for source listings + Google search | $5 credits/mo |
| **ATTOM Data** | National property records (homeowner-side cold) | dev tier free |
| **PropertyRadar** | Richer property filters (alternative to ATTOM) | 7-day trial |
| **Apollo.io** | People enrichment / skiptracing | 100 credits/mo free |
| **Hunter.io** | People-search fallback for skiptracing | 25 searches/mo free |

### Marketplace side (only if your merchant has partner referrals)

| Provider | What it does | Free tier? |
|---|---|---|
| **Yelp Fusion** | Top-rated local partners by category + zip | 5,000 calls/day free |

### Communications + mail (optional, configured but constrained)

| Provider | What it does | Notes |
|---|---|---|
| **Lob** | Postcard mailer | needs verified return address; gated behind admin `mailer_enabled` |
| **Twilio** | SMS (TCPA-gated) | needs A2P 10DLC registration: business EIN + tax ID required before any SMS will deliver to US carriers |
| **ImprovMX** | Silent inbound forwarder for `replies@<your-domain>` to operator inbox | free |

---

## 3. Configure env vars in Vercel (~10 min)

In your Vercel project → Settings → Environment Variables. Paste each key.

### Zilla-managed secrets (pulled from Vercel, not copy-pasted)

Three Zilla-platform-wide secrets are managed once at the Zilla-HQ Vercel team level and inherited by every merchant project. **Do not paste them into chat, Slack, or this repo's `.env.example`.** Pull them locally with:

```bash
npx vercel link             # one-time, links your local checkout to the Vercel project
npx vercel env pull .env.local
```

After that, your gitignored `.env.local` has every shared secret populated. The relevant ones for the Meta side are:

```bash
# Zilla parent Meta — token only; the IDs are in .env.example as real values
ZILLA_SYSTEM_USER_TOKEN=     # never-expiring System User token
                             # See ZILLA_HQ_SETUP_META.md if it ever needs to be regenerated
```

If `vercel env pull` returns the value empty, the var is flagged **Sensitive** in Vercel — un-flag it temporarily, pull, then re-flag. This is the same mechanism §7 uses for `R2_ACCESS_KEY_ID` and `FAL_API_KEY`.

If you don't have Vercel access, ask Jack to add you to the Zilla-HQ Vercel team. **Do not** ask anyone to paste the token in Slack — the right answer is "let me get you Vercel access."

### Universal (every merchant)

```bash
# Database
DATABASE_URL=postgresql://...        # Supabase Supavisor pooler URL (port 6543)

# App URL
NEXT_PUBLIC_APP_URL=https://<your-domain>

# Brand
BUSINESS_NAME="<Your Merchant>"
BUSINESS_ADDRESS="<Physical mailing address>"   # required by CAN-SPAM, no bypass
SUPPORT_EMAIL=hello@<your-domain>

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/admin/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/admin/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/admin
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/admin
ADMIN_EMAIL=you@yourdomain.com
ADMIN_EMAIL_DOMAINS=yourdomain.com,otherteam.com

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_INBOUND_WEBHOOK_SECRET=...        # set after you create the inbound webhook
SENDER_DOMAINS=mail.<your-domain>        # comma-separated for rotation
SENDER_FROM_NAME="<Your Merchant>"
REPLIES_EMAIL=replies@<your-domain>

# Workflow runtime (Inngest)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Object storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=<merchant>-photos

# Generation
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001  # or claude-sonnet-4-5 for higher-stakes drafting

# Analytics
POSTHOG_PROJECT_API_KEY=phc_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Caps + budgets
DAILY_SEND_CAP=500
PREVIEW_DAILY_CAP=1000
FULFILLMENT_DAILY_BUDGET_CENTS=10000
```

### Per-merchant (depends on what's in your service catalog)

```bash
# fal.ai (image generation)
FAL_API_KEY=...
FAL_PREVIEW_MODEL=fal-ai/flux-pro/kontext

# Mapbox (only if any service uses satellite_tile imageSource)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

# Apify (scraping)
APIFY_TOKEN=apify_api_...
APIFY_ZILLOW_ACTOR=maxcopell/zillow-scraper       # or your vertical's source actor
APIFY_REDFIN_ACTOR=tugkan/redfin-scraper
APIFY_REALTOR_ACTOR=epctex/realtor-scraper

# Property data + skiptracing (only if cold B2C outreach)
ATTOM_API_KEY=...
PROPERTYRADAR_API_KEY=...
APOLLO_API_KEY=...
HUNTER_API_KEY=...
HOMEOWNER_DISCOVERY_ZIPS=08402,07760    # comma-separated allowlist
HOMEOWNER_DISCOVERY_LIMIT=10            # per-service-per-zip cap

# Yelp (only if marketplace side)
YELP_API_KEY=...
CONTRACTOR_REFERRAL_FEE_USD=150

# Lob (optional postcard mailer)
LOB_API_KEY=test_...   # or live_...

# Twilio (optional SMS — TCPA-gated)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

> **Important about Resend:** add your sending subdomain (e.g. `mail.<your-domain>`) in the Resend dashboard and click **Verify**. The Vercel-Resend integration auto-adds DKIM/SPF DNS records. Until verified, all sends use Resend's sandbox sender (`resend.dev`) and land in spam.

> **Important about Stripe webhook:** in Stripe → Developers → Webhooks, add `https://<your-domain>/api/stripe/webhook` and subscribe to `checkout.session.completed`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

> **Important about Resend inbound webhook:** in Resend → Webhooks, add `https://<your-domain>/api/resend/webhook` and subscribe to `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained` for outbound tracking, and `inbound.email` for replies. Copy the signing secret to `RESEND_INBOUND_WEBHOOK_SECRET`.

---

## 4. Migrate the database (~2 min)

```bash
# Push the Drizzle schema to Supabase
pnpm drizzle-kit push --config drizzle.config.ts
```

This creates a `merchant` Postgres schema with all 9 tables. Verify in Supabase → Table Editor.

---

## 5. Deploy (~2 min)

```bash
vercel deploy --prod
```

Visit `https://<your-domain>/admin/sign-up`, create your account (email must match `ADMIN_EMAIL` or be on `ADMIN_EMAIL_DOMAINS`).

The readiness checklist on `/admin` should now show mostly green. Anything that's red is an env var the autonomous loop expects and didn't find.

---

## 6. Customize (the real work — see MERCHANT.md)

Open [**MERCHANT.md**](./MERCHANT.md) and work the checklist top-to-bottom. The most impactful files in order:

1. **`lib/services.ts`** — your service catalog (the heart of the merchant)
2. **`app/(marketing)/page.tsx`, `audience-a/page.tsx`, `audience-b/page.tsx`** — page copy
3. **`components/marketing/faq.tsx`** — FAQs
4. **`lib/apify.ts` + `inngest/functions/discovery.ts`** — discovery sources
5. **`lib/falai.ts` + `lib/claude.ts`** — generation prompts
6. **`scripts/generate-service-samples.mjs`** — generate sample before/afters for the homepage

Run `npx tsc --noEmit` after each big edit to catch type errors. Run `pnpm dev` to preview locally.

---

## 7. Generate sample images (~5 min, once)

After defining your services in `lib/services.ts`, point `scripts/generate-service-samples.mjs` at appropriate source URLs + prompts and run:

```bash
vercel env pull .env.production --environment=production
node --env-file=.env.production scripts/generate-service-samples.mjs
rm .env.production
```

This uploads before/after images to R2 under `samples/services/<service-id>-before.jpg` + `<service-id>-after.jpg`. The site signs URLs at render time.

> If `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, or `FAL_API_KEY` are flagged Sensitive in Vercel, `vercel env pull` returns them empty. Either un-flag them temporarily or paste the values into `.env.production` manually before running the script.

---

## 8. Verify the loop (~5 min)

- [ ] Visit `/admin` → readiness checklist mostly green
- [ ] Click **"Run discovery now"** → "Realtor scrape" (or your audience-a equivalent)
- [ ] Within ~60s, new rows appear in `/admin/listings`
- [ ] Within another minute, new previews appear in `/admin/listings`
- [ ] If those listings have agent emails, outreach fires automatically and shows on `/admin/outreach`
- [ ] Send yourself one test outreach by manually editing a listing's `agentEmail` to your own → wait for the next preview cycle
- [ ] Reply to that test email → confirm `/admin/outreach/<id>` shows your inbound reply + the auto-classifier's verdict
- [ ] Open the `/l/<slug>` URL → checkout flow works in Stripe live mode
- [ ] Complete a $1 test purchase → `orders/paid` event fires → fulfillment runs → delivery email arrives

If all 8 verifications pass, your merchant is autonomous. Now flip the discovery cron's `paused` flag off in `/admin/settings` (it's off by default) and let the 6h/12h cron run.

---

## 8b. SEO setup (~5 min for autonomous, ~15 min for manual)

Optional if your merchant has no public marketing surface. Required if you want strangers to find the merchant via search.

### `*.zilla.so` subdomain merchants — fully autonomous

If the Zilla HQ one-time setup is done (see [ZILLA_HQ_SETUP.md](./ZILLA_HQ_SETUP.md)), per-merchant SEO is no-touch:

- [ ] `node scripts/generate-indexnow-key.mjs` — writes `public/<key>.txt`, prints the env var. Commit + push.
- [ ] Set `NEXT_PUBLIC_INDEXNOW_KEY` in Vercel env (printed value).
- [ ] Confirm `NEXT_PUBLIC_APP_URL` is set.
- [ ] **`npm run seo:propagate -- --targets <new-merchant>`** — auto-pulls the four shared HQ creds from an existing merchant and pushes them to the new project. One command, no env-var pasting.
- [ ] Deploy.
- [ ] Hit `/admin/seo` → "Run SEO bootstrap" (or wait for the daily 04:00 UTC cron). Step-by-step result shows in the panel.

That's it. The bootstrap **adds the property to GSC + Bing**, **verifies ownership**, **submits the sitemap to both engines**, and **pings IndexNow** with every URL — all on the merchant's behalf. Re-running is idempotent.

### Apex-domain merchants — manual (or autonomous with apex-specific token)

Full runbook: [**SEO.md**](./SEO.md) §2. Compressed checklist (manual path):

- [ ] Add merchant URL to [Google Search Console](https://search.google.com/search-console) → URL prefix → HTML tag method → send token to engineer.
- [ ] Engineer sets `NEXT_PUBLIC_GOOGLE_VERIFICATION` in Vercel env, redeploys.
- [ ] Operator clicks **Verify** in GSC. Submits `sitemap.xml`.
- [ ] Add merchant URL to [Bing Webmaster Tools](https://www.bing.com/webmasters) → XML File method → send token to engineer.
- [ ] Engineer runs `BING_TOKEN=<token> node scripts/generate-bing-auth-file.mjs`, commits, deploys.
- [ ] Operator clicks **Verify** in Bing Webmaster. Submits sitemap.
- [ ] Engineer runs `node scripts/indexnow-ping.mjs` to push every URL to Bing for instant indexation.

To skip the manual step entirely on an apex domain, mint a per-merchant `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN` against that apex's verified GSC property and use the autonomous flow.

---

## 8c. X (Twitter) brand-account setup (~10 min)

Optional if the merchant has no plausible X audience. Required if you want autonomous post + auto-reply on X.

Pre-condition: Zilla HQ one-time setup is done (see [ZILLA_HQ_SETUP_X.md](./ZILLA_HQ_SETUP_X.md)). Then per merchant:

- [ ] **Create the brand X account** (e.g. `@Sitebeatapp`). Real account, real bio, profile pic + banner.
- [ ] **Add the merchant's callback URI** to the Zilla HQ X dev app at developer.x.com:
      `https://<app-url>/api/auth/x/callback`
- [ ] **Set the four env vars** in the merchant's Vercel project:
  - `X_CLIENT_ID`, `X_CLIENT_SECRET` — paste from the Zilla HQ vault (HQ-shared)
  - `X_BRAND_NAME`, `X_BRAND_HANDLE`, `X_BRAND_ABOUT` — per-merchant brand prompt; see [X.md §2.2](./X.md#22-set-per-merchant-brand-prompt)
- [ ] **Authorize the brand account**: in a browser logged into X as the brand, navigate to `https://<app-url>/api/auth/x/start`. Click Authorize. Callback persists the refresh token to `admin_settings.x_refresh_token`.
- [ ] Confirm `/admin/x` shows "✓ Refresh token saved for @<handle>".
- [ ] Send a test tweet from `/admin/x` → Compose. Verify it lands at `x.com/<handle>/status/<id>`.

The Inngest cron `xMentionsPollFn` polls every 30 minutes. Trigger manually from Inngest with the `x-mentions/poll` event for the first run.

Full runbook: [**X.md**](./X.md). One-time HQ provisioning: [**ZILLA_HQ_SETUP_X.md**](./ZILLA_HQ_SETUP_X.md).

---

## 9. Troubleshooting

**Discovery fires but no listings appear**
The Apify actor returned empty. Open `lib/apify.ts` and tighten the search input (e.g. for Zillow, replace the bare homepage URL with a metro-specific search URL).

**Outreach doesn't fire even though listings exist**
Check `outreach_paused` in admin settings. Check `agent_email` is populated on the listing (some sources don't expose it). Check the daily-send-cap and complaint-rate kill-switch.

**`vercel env pull` returns empty values for some keys**
Those keys are flagged "Sensitive" in Vercel. Either flip the flag, or paste values into `.env.production` manually for local script runs.

**Sample images show as placeholders**
You haven't run `scripts/generate-service-samples.mjs` yet. Until you do, `lib/samples.ts` falls back to placeholder URLs.

**Resend sends land in spam**
Your sending subdomain isn't verified yet. Check Resend → Domains and click Verify after Vercel-Resend has propagated DKIM/SPF (usually < 1 hour).

**"Discovery cron isn't producing real volume"**
The cron is wired correctly but the actor input is too narrow / too broad / wrong source for your vertical. This is the #1 thing operators have to tune per merchant.

---

## What now

You have a fully autonomous merchant. The 6h discovery cron will run on its own, qualified leads will get personalized previews and cold emails, replies will be classified and (mostly) auto-handled, payments will be taken, fulfillment will run, deliveries will go out, and the contacts directory + outreach thread view will let you observe the whole machine without ever opening a terminal.

Iterate by reading `/admin` every day, watching the readiness checklist, and tightening one thing at a time.
