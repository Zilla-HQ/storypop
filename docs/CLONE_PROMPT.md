# Sitebeat — full clone prompt for Kimi / DeepSeek / any agentic model

Copy everything below the "---" into the model. Self-contained, no follow-up needed.

---

You are an autonomous engineer. Your task is to build **Sitebeat**, a fully autonomous SEO-monitoring SaaS, end to end. The result must be a Next.js app deployed to Vercel with a working customer funnel from cold-outreach to paid subscription, running hands-free on a cron schedule.

## Product

**Sitebeat** is autonomous SEO monitoring for small businesses (restaurants, HVAC, contractors, dentists, indie SaaS). The funnel:

1. Visitor enters their URL on the homepage
2. Backend crawls the site and runs **15 SEO checks**, returns a letter-graded report (A+ through F)
3. Email arrives with the full report + per-check fix instructions + one-click subscribe buttons ($29/month or $290/year)
4. After subscribing, a weekly cron re-audits the site every Monday and sends an alert email *only* when something regresses (drops grade, fails new check)
5. Stripe handles billing; Customer Portal handles self-cancellation

**Cold-outreach loop runs in parallel**: every 6h a Vercel cron scrapes directory pages (Eater "best of" lists, Bob Vila contractor articles, etc.), extracts company URLs, finds each company's contact email (mailto: scraping + footer scraping + `info@<domain>` fallback with MX validation), runs the audit, sends the report email with subscribe CTAs.

## Tech stack — non-negotiable

- **Next.js 15** App Router, TypeScript strict mode
- **Drizzle ORM** + **Supabase Postgres** (Supavisor transaction pooler, port 6543)
- **Inngest Cloud** for event-driven workflows + cron (you can use Vercel cron as a simpler alternative)
- **Stripe Checkout** in `mode: subscription` + webhook for `customer.subscription.created/updated/deleted` and `invoice.payment_failed`
- **Resend** for transactional email, with CAN-SPAM compliance baked in (auto-injected physical-address footer + List-Unsubscribe headers, no bypass)
- **Clerk** for `/admin/*` auth, with email-domain allowlist
- **Meta Pixel + Conversions API** for ad attribution
- **Cheerio** (server-side HTML parsing) for the SEO audit engine and email-finder
- Edge runtime for OG ad-image generation via `next/og`

## The 15 SEO checks (all in `lib/seo-checker.ts`, single function `runAudit(url)`)

Each check has: `id, name, status (pass|warn|fail), detail, points, earned`. Pure async function, no DB writes — caller persists the result.

1. **HTTPS** — page served over TLS (10 pts)
2. **Meta description** — 120-160 chars (8 pts)
3. **Heading structure** — exactly one H1, H2s for sections (8 pts)
4. **Page speed** — TTFB < 600ms pass, < 2s warn, > 2s fail (8 pts)
5. **Sitemap.xml** — exists at `/sitemap.xml` and returns 200 (8 pts)
6. **Robots.txt** — exists with valid `User-agent` directive (6 pts)
7. **Canonical tag** — `<link rel="canonical">` present (8 pts)
8. **Mobile viewport** — `<meta name="viewport" content="width=device-width">` (8 pts)
9. **Language attribute** — `<html lang="...">` set (4 pts)
10. **Image alt text** — % of `<img>` with `alt=""` attr (8 pts)
11. **Open Graph tags** — `og:title`, `og:description`, `og:image` (6 pts)
12. **Broken links** — first 8 internal links return < 400 (8 pts)
13. **Structured data (JSON-LD)** — at least one `<script type="application/ld+json">` (6 pts)
14. **Local Business Schema** — JSON-LD includes `LocalBusiness` / `Restaurant` / `Plumber` / etc. — critical for Google local pack (6 pts)
15. **NAP consistency** — visible phone (tel: link or US format) AND street address (regex-matched suffix or PostalAddress JSON-LD) (6 pts)

Score = 100 × (sum of earned / sum of points). Letter grade: A+ ≥ 95, A ≥ 90, B+ ≥ 85, B ≥ 80, C+ ≥ 75, C ≥ 70, D ≥ 60, F < 60.

## Per-check "How to fix" recommendations

For every failing/warning check, surface a `why this matters` paragraph + a `fix` paragraph in BOTH the audit results page AND the email. Example for `local_schema`:

- **Why**: Google's "local pack" (the 3-result map block at the top of search results) only shows businesses with proper LocalBusiness schema. Without it, you're invisible to most "near me" searches even if your site otherwise has good SEO.
- **Fix**: Add `<script type="application/ld+json">` with the most specific schema type that applies (Restaurant, Plumber, Dentist, etc.) including `name`, `address` (PostalAddress), `telephone`, `openingHoursSpecification`, `priceRange`.

Write recommendations for ALL 15 checks in a `lib/check-recommendations.ts` keyed by check id. This is the conversion-driving copy — generic SEO tools don't do this.

## Schema (Drizzle) — Postgres schema named `sitebeat`

```ts
sites (id uuid pk, site_url text unique, customer_email text, last_audit_at timestamptz, created_at, updated_at)
audits (id uuid pk, site_id uuid fk, status text default 'pending', score int, ttfb_ms int, report jsonb, error_message text, run_at timestamptz, created_at)
subscriptions (id uuid pk, site_id uuid fk, customer_email text, stripe_customer_id, stripe_subscription_id unique, stripe_price_id, status enum [trialing|active|past_due|canceled|incomplete], current_period_end, created_at, canceled_at)
admin_settings (id int pk default 1, paused bool, monitoring_paused bool, discovery_paused bool, sender_domains jsonb, email_blacklist jsonb, updated_at)
agent_costs (id, date text, agent text, cost_cents int, created_at)
```

## Inngest functions (or Vercel-cron equivalents)

1. **`auditFn`** — listens for `audit/run-requested`, runs `runAudit()`, persists, emits `audit/complete`
2. **`auditReportEmailFn`** — listens for `audit/complete`, emails the report via Resend if site has customer_email
3. **`weeklyAuditDispatcherFn`** — cron `0 14 * * 1` (Mondays 14:00 UTC), queries `subscriptions where status='active'`, fans out one `audit/run-scheduled` per
4. **`weeklyAuditRunnerFn`** — listens for `audit/run-scheduled`, runs audit, diffs vs most recent prior `audits` row for same site, emits `audit/regressed` if any check went pass→warn/fail or score dropped 5+
5. **`regressionAlertFn`** — listens for `audit/regressed`, emails one-screen diff summary
6. **`discoveryOutreachFn`** — cron every 6h, scrapes `DISCOVERY_SEED_URLS` env (comma-separated directory pages), dedupes against `sites` table, finds emails, fires `audit/run-requested` per new prospect

## Routes

- `/` — homepage with hero + URL+email form + stats strip + how-it-works + 13-check grid + pricing + FAQ + final CTA
- `/audit/[id]` — live-polling results page with letter grade card + issues-first sections + expandable "How to fix" rows + Subscribe CTAs at the top
- `/audit/[id]/print` — print-friendly version (Cmd+P → Save as PDF)
- `/pricing` — Monthly + Annual cards
- `/subscribe?siteId=X&plan=monthly|annual` — server route that creates a Stripe Checkout session and 302s to it (one-click from email)
- `/api/audit` POST + GET — submit URL + poll status
- `/api/checkout` POST — create Stripe Subscription Checkout
- `/api/stripe/webhook` POST — handle subscription lifecycle events
- `/api/billing-portal?siteId=X` — mint Stripe Customer Portal session
- `/api/discover` POST + `/api/cron/discover` GET — scrape directory pages, fan out to outreach
- `/api/outreach` POST — accepts `{urls: []}`, finds emails, MX-validates, fires audits
- `/api/inngest` — Inngest endpoint
- `/api/resend/webhook` — Resend webhook receiver
- `/admin` + `/admin/sites` + `/admin/audits` + `/admin/subscriptions` + `/admin/outreach` + `/admin/emails` + `/admin/settings` — Clerk-gated dashboard with live Resend metrics, spend tracking, email click-through with rendered HTML viewer, daily volume sparkline, score-history charts for subscribers
- `/og-ad?v=hook|fix|weekly&format=square|vertical` — auto-generated 1080×1080 (or 1080×1920) ad creative PNGs via `next/og`

## Email design

Both audit-report email and regression-alert email:
- Big colored letter-grade circle in the header (visceral)
- **Subscribe buttons appear ABOVE the long check list** — fastest path to payment
- Per-check "Fix:" italic line under each issue
- Subject line: `{host} got a {grade} — {N} SEO issues to fix`

## Cold-outreach engineering

- **`lib/find-company-email.ts`**: scrape homepage + 11 common contact paths (`/contact`, `/about`, `/team`, `/staff`, etc.). Score candidates: mailto link (+30) > footer text (+10) > body text. Same-domain bonus (+50). Block prefixes: `noreply, postmaster, abuse, donations, billing, user, you`. Block placeholder full-emails: `user@domain.com, you@example.com`. Block hex-only locals (32+ chars — error tracker DSNs like Sentry).
- **`lib/extract-site-urls.ts`**: from a directory page, extract outbound `<a href>` URLs that look like company sites. Filter social (twitter/linkedin/etc.), reservation platforms (opentable/resy/toasttab), parent media domains (voxmedia/timeout.group), tracker params (utm_/fbclid). Normalize to origin.
- **`lib/validate-email.ts`**: `hasMxRecord(email)` via `dns/promises.resolveMx()` with 4s timeout + per-domain in-memory cache. Skip cold-outreach to domains with no MX records (cuts ~80% of "domain not found" bounces).
- **CAN-SPAM compliance** in `lib/resend.ts`: every send auto-injects `BUSINESS_NAME + BUSINESS_ADDRESS` footer + 1-click unsubscribe URL `/unsubscribe?l=<siteId>` + `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers. No bypass — extend MJML if needed, never add a "raw send" helper.

## Provisioning (env vars on Vercel)

```
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-1-<region>.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_APP_URL=https://<your-domain>
BUSINESS_NAME=Sitebeat
BUSINESS_ADDRESS=<real legal mailing address>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
ADMIN_EMAIL_DOMAINS=zilla.so,seifdn.org
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_MONTHLY=price_...   # $29/mo recurring
STRIPE_PRICE_ANNUAL=price_...    # $290/yr recurring
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
SENDER_DOMAIN=mail.<your-domain>  # verified in Resend
SENDER_DOMAINS=mail.<your-domain>  # rotation list
REPLIES_EMAIL=replies@mail.<your-domain>
RESEND_INBOUND_WEBHOOK_SECRET=whsec_...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
DISCOVERY_SEED_URLS=https://ny.eater.com/maps/best-new-york-restaurants-38-2,https://www.bobvila.com/articles/best-hvac-companies/,...
DISCOVERY_PER_SEED_MAX=15
DISCOVERY_PER_RUN_CAP=20
OUTREACH_SECRET=<random-32-byte-hex>
NEXT_PUBLIC_META_PIXEL_ID=...
META_ACCESS_TOKEN=<for marketing api>
```

## Tracking — Meta Pixel must fire client-side AND server-side

- Client: standard fbq snippet in `app/layout.tsx`. Auto-fires `PageView`. Custom `Lead` event from the audit-form on submit success. Custom `Purchase` event on `/audit/[id]?subscribed=1` (Stripe success_url).
- Server (Conversions API): in the Stripe webhook handler, after persisting the subscription, POST to `https://graph.facebook.com/v18.0/{PIXEL_ID}/events?access_token={SYSTEM_USER_TOKEN}` with the `Subscribe` event. iOS Mail Privacy + ad-blockers stop the client-side pixel; CAPI catches them.

## What "done" looks like

- **End-to-end smoke test passes** in this order:
  1. Submit `example.com` + `you@you.com` on `/` → redirected to `/audit/<id>` showing live audit
  2. Within 30s, audit completes, page shows letter grade + 15 checks
  3. Within 60s, email arrives with the rendered report
  4. Click Subscribe → Stripe Checkout → complete with test card (4242 4242 4242 4242)
  5. Webhook hydrates `subscriptions` row
  6. Land on `/audit/<id>?subscribed=1` showing green "Subscribed" banner
  7. Force `weeklyAudit/manual` event → runner picks up, runs audit, emits no event (no regression vs identical prior)
  8. Manually update `audits.score` to score-15 in Postgres → fire manual event again → `audit/regressed` event fires → regression-alert email arrives
  9. `/api/cron/discover` GET (with seeds set) → scrapes pages, queues new prospects for audit
- **`/admin` shows live metrics** for all-time sites/audits/subscriptions + last-14-day daily email volume sparkline + recent emails table with click-through to rendered HTML
- **0 typecheck errors** with `tsc --noEmit`. **0 lint errors** with `next lint`. **Build succeeds**.

## Constraints

- **Don't use any paid scrapers** (Apify Actors are paid as of 2026 — use direct cheerio + fetch instead)
- **Don't ship without MX validation** on cold-outreach emails
- **Don't ship without CAN-SPAM compliance** in every outbound send
- **Don't ship without Stripe Customer Portal** enabled (subscribers must be able to self-cancel)

## Stretch goals (after the core works)

- Multi-page audit (crawl sitemap, audit top 10 pages instead of just homepage)
- Lighthouse-based real Core Web Vitals via Google PageSpeed Insights API (free)
- Competitor side-by-side comparison page
- Slack alert integration (in addition to email)
- API access for agencies (`/api/v1/audit`)
- Pro tier ($99/mo): multi-site monitoring, Slack alerts, competitor benchmark
- White-label reports (custom branding for agency tier)

---

End of prompt. Build it. Smoke-test it. Don't ask permission for low-risk decisions; ship.
