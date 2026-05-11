# Merchant template — fork-and-config checklist

This repo is the **Realscale** merchant (real-estate photo enhancement). Forking it for a new merchant is the cheapest path to merchant #2 while we're still discovering what's actually shared. This doc is the full catalog of **every place** that needs to change, organized by category. Work top-to-bottom and the new merchant ships.

> **Don't touch** = platform code that should be merchant-agnostic. If you find yourself editing it, that's a signal to lift the change up to a config or a future `@zilla/platform` package — not bury it in the fork.

---

## 0. Pre-fork: clone + rename

- Fork the repo on GitHub (`Zilla-HQ/realestate` → `Zilla-HQ/<merchant-slug>`).
- New Vercel project pointed at the fork.
- New domain (e.g. `<merchant>.app` or subdomain of a parent zone). Add via Vercel; auto-DNS will offer to provision DKIM/SPF for a Resend subdomain.
- New Supabase project (database isolation is the strongest compliance posture; do **not** reuse the Realscale DB).
- New Stripe account or new Stripe Connect sub-account.
- New Clerk app.
- New R2 bucket (or namespace within an existing bucket).
- New Inngest app (or shared with a tenant tag).
- New PostHog project.

Cost of all of the above: ~30 min and ~$0 in monthly platform fees until volume spikes.

---

## 1. Brand + identity (sweep first — cheapest blast radius)

These are pure string swaps. Do them before anything functional.

### Required
- [ ] **`lib/resend.ts:8`** — default `BUSINESS_NAME = "Realscale"` → new merchant name.
- [ ] **`lib/lob.ts:7`** — same default.
- [ ] **Vercel env: `BUSINESS_NAME`, `BUSINESS_ADDRESS`** — real legal name + physical mailing address (CAN-SPAM hard requirement, no bypass).
- [ ] **Vercel env: `SENDER_DOMAINS`** + admin settings `senderDomains` JSONB column — should match the new verified Resend subdomain (e.g. `mail.<merchant>.app`).
- [ ] **Vercel env: `REPLIES_EMAIL`** — public-facing reply address for the new domain.
- [ ] **`app/(marketing)/page.tsx`** — homepage chooser (currently "I sell homes / I own a home"). Change copy + funnel CTAs to fit new audiences.
- [ ] **`app/layout.tsx` + `app/(marketing)/layout.tsx`** — `<title>`, `<meta>`, header brand mark.
- [ ] **`app/admin/layout.tsx:20`** — admin sidebar brand text ("Realscale").
- [ ] **`app/admin/sign-in/...page.tsx` + `sign-up/...page.tsx`** — sign-in copy.
- [ ] **`components/marketing/footer.tsx`** — footer brand + links.
- [ ] **`README.md`** — top-level description.

### Optional
- [ ] Favicon, OG image, social cards (`app/icon.*`, `app/opengraph-image.*` if present).
- [ ] Brand colors in `tailwind.config.ts` if the new merchant has its own palette.

---

## 2. Service catalog — the heart of the merchant

This is where merchant identity actually lives. Everything else flows from here.

### Required
- [ ] **`lib/services.ts`** — replace the 5 services (photo-staging, twilight-exterior, curb-appeal, pool-mockup, solar-mockup) with the new merchant's. Each service needs:
  - `id` / `name` / `shortDescription` / `longDescription`
  - `basePriceCents` / `rushPriceCents`
  - `category` (free-form vertical tag)
  - `audience` (`agents`, `renovate`, or `both` — these names are real-estate-specific; rename the `Audience` type in `lib/services.ts:14` to your two funnels, e.g. `seller / buyer`, `lender / borrower`)
  - `imageSource` (`listing_photo` | `satellite_tile` | `exterior_facade`) — drives which preview branch fires; rename if the merchant operates on a different artifact (PDFs, audio, HTML) and add the corresponding branch in `inngest/functions/preview.ts`
  - `promptTemplate` — fal.ai Kontext prompt the preview agent runs against the source artifact
  - `ctaPrimary` / `emailSubjectTemplate`
  - `icon` (lucide-react name)

- [ ] **`lib/samples.ts`** — replace the 5 sample IDs + captions + audiences. Regenerate the actual before/after images via:
- [ ] **`scripts/generate-service-samples.mjs`** — replace the 5 SAMPLES with new source URLs + prompts. Run `node --env-file=.env.production scripts/generate-service-samples.mjs` to upload to R2.

### Don't touch
- `lib/services.ts` lookup helpers (`getService`, `servicesForAudience`, `DEFAULT_SERVICE_ID`).
- `lib/samples.ts:getSampleBeforeAfters` / `getSampleForService` filtering logic.

---

## 3. Page copy — the marketing funnel

Two parallel funnels today: `/agents` (paid) and `/renovate` (free + referral). Rename routes to match the new merchant's funnels.

### Required
- [ ] **`app/(marketing)/agents/page.tsx`** — rename folder to e.g. `app/(marketing)/<funnel-1>/`. Update:
  - Hero headline + subhead
  - The `STATS` array (4 stats with figures + sources, currently real-estate research) — replace with vertical-relevant proof points
  - Pricing card copy ($89 / $138 / $149)
  - The `<SelfServeForm fixedServiceId="…">` default service
- [ ] **`app/(marketing)/renovate/page.tsx`** — rename to `app/(marketing)/<funnel-2>/`. Update:
  - Hero, the address-vs-URL form choice, "How it works" steps
  - The free + referral framing if monetization differs
- [ ] **`app/(marketing)/services/page.tsx`** + `services/[serviceId]/page.tsx`** — copy, FAQ ref. Probably re-usable as-is once `lib/services.ts` is swapped.
- [ ] **`app/(marketing)/l/[listingSlug]/page.tsx`** — the personalized preview page. The "Like it? Get matched" contractor section is renovate-specific; gate on `service.audience === "renovate"` is already in code, but the language ("contractors") may need a new vertical noun.
- [ ] **`components/marketing/faq.tsx`** — `AGENT_ITEMS` + `HOMEOWNER_ITEMS` arrays. Replace with the new merchant's FAQs. The `Audience` type rename in §2 ripples to here.
- [ ] **`app/(marketing)/disclosure/page.tsx`** — currently NAR virtual-staging disclosure. Replace with whichever vertical disclosure the new merchant needs (FINRA suitability, HIPAA, SEC, FTC affiliate, or just delete if none).
- [ ] **`app/(marketing)/privacy/page.tsx`** + **`app/(marketing)/terms/page.tsx`** — sub-processor list mentions Anthropic, fal.ai, OpenAI. Add/remove based on which APIs the new merchant uses.

### Don't touch
- `app/(marketing)/checkout/`, `delivery/[orderId]/`, `unsubscribe/` — payment + delivery + opt-out shell are platform-level.

---

## 4. Discovery sources — where leads come from

Realscale scrapes Zillow / Redfin / Realtor for realtors and ATTOM / PropertyRadar for homeowners. Replace with the new vertical's equivalents.

### Required
- [ ] **`lib/apify.ts`** — `fetchZillow`, `fetchRedfin`, `fetchRealtor` and their normalizers. Replace with the new vertical's source actors. The `ScrapedListing` type is generic enough to keep (`address`, `agentName`, `agentEmail`, `agentPhone`, `photos`, `price`, `dom`) — rename `agentEmail`/`agentName`/`agentPhone` if the new merchant's primary contact isn't an "agent" (it's just the recipient of the cold email).
- [ ] **`inngest/functions/discovery.ts`** — the cron itself rarely changes; what changes is `PRICE_MIN_CENTS` (line 9) and which `fetch*` functions get called.
- [ ] **`inngest/functions/self-serve-ingest.ts`** — `pickActor` + `normalize*` per source. Same model as discovery.
- [ ] **`lib/homeowner-discovery.ts`** — ATTOM + PropertyRadar are real-estate-specific. If the new merchant has a B2C cold side, swap to whichever data provider serves that vertical (e.g. ZoomInfo for B2B, Apollo for SaaS contacts, Hunter for domain-based lookups). If no B2C side, delete the file + the cron.
- [ ] **`inngest/functions/homeowner-discovery.ts`** — adjust or delete based on the above.

### Don't touch
- `runApifySync` helper in `self-serve-ingest.ts` — generic Apify REST wrapper.
- The `listings/qualified` event flow — that's the platform contract.

---

## 5. Generation prompts — the actual agent skill

### Required
- [ ] **`lib/falai.ts`** — `generateStagedPreview` builds a real-estate-specific staging prompt. Either generalize it (pass the full prompt from `services.ts`) or rewrite per-merchant.
- [ ] **`lib/claude.ts:draftOutreachEmail`** — system prompt is real-estate copywriter. Replace.
- [ ] **`lib/claude.ts:fallbackBody`** + `buildMjml` — fallback email + MJML template reference photos + checkout. Generalize image references; the `bodyMjml` template is reusable.
- [ ] **`inngest/functions/outreach.ts:buildHomeownerEmail`** — currently "your home with a pool" copy. Rewrite for the new vertical's homeowner-equivalent audience.
- [ ] **`lib/claude.ts:classifyReply`** — reply classifier categories (`price_question`, `style_question`, `decline`, `unsubscribe`, `complex`). Probably reusable across merchants; revisit only if the inbound copy is dramatically different.

### Don't touch
- `lib/claude.ts:callClaude` (generic Anthropic wrapper).

---

## 6. Compliance gates — keep most of these

### Required (per merchant)
- [ ] **`lib/watermark.ts`** — currently stamps "Virtually Staged" per NAR. If the new vertical has a different mandatory disclosure (FTC affiliate stamp, FINRA disclaimer, HIPAA marker), replace the string. If none, remove the watermark step from `inngest/functions/fulfillment.ts`.
- [ ] **`app/(marketing)/disclosure/page.tsx`** — same as §3.

### Don't touch
- **`lib/resend.ts:sendComplianceEmail`** — CAN-SPAM footer + List-Unsubscribe headers. Universal; **do not add a bypass**.
- **`lib/state-optout.ts:checkOptOut`** — CCPA/CPA hard-coded protections. Universal.
- **TCPA gate in `lib/twilio.ts`** — universal SMS-only-after-consent.
- The blacklist in `admin_settings.email_blacklist`.

---

## 7. Marketplace / partner side (only if applicable)

Realscale has a contractor-referral marketplace on the `/renovate` side. If the new merchant has a partner/referral side:

### If the merchant has a marketplace side
- [ ] **`lib/yelp.ts`** — `SERVICE_CATEGORY` map + `searchBusinesses` is Yelp-specific. Replace with whatever directory serves the new vertical (e.g. AdvisorChecker for advisors, Avvo for lawyers, Zocdoc for healthcare).
- [ ] **`lib/find-contractor-email.ts`** — generic enough (Yelp profile → website → scrape → fallback Apify Google search). Update the `SKIP_DOMAINS` list if the new directory uses different aggregators.
- [ ] **`inngest/functions/match-contractors.ts`** — the agent itself; copy + referral terms ($150) are merchant-specific.
- [ ] **`db/schema.ts:contractorLeads` / `contractorIntros`** — column names use "contractor" terminology. Rename if it'd confuse maintainers; otherwise leave (they're partner-of-record records).
- [ ] **`app/admin/leads/page.tsx`** — admin view of matches.

### If the merchant has no marketplace side
- [ ] Delete `lib/yelp.ts`, `lib/find-contractor-email.ts`, `inngest/functions/match-contractors.ts`, `app/admin/leads/page.tsx`, the `lead/captured` event in `inngest/client.ts`, and the `ContractorLeadForm` component.

---

## 8. Pricing + scoring

### Required
- [ ] **`db/settings.ts:DEFAULT_STYLE_PRESETS`** — currently 4 interior-design styles. Replace with merchant-relevant presets or remove.
- [ ] **Vercel env: `PRICING_STANDARD_CENTS`, `PRICING_PREMIUM_CENTS`, `PRICING_RUSH_CENTS`** — defaults baked into admin settings on first init.
- [ ] **`lib/scoring.ts`** — qualification thresholds (`maxPhotoScore`, `minAgentValueScore`, `minPriceCents`). Replace with the new merchant's qualification criteria.
- [ ] **Vercel env: `CONTRACTOR_REFERRAL_FEE_USD`** — defaults to $150; update if the new partner economics differ.

### Don't touch
- The `outreach_events` daily-send-cap and complaint-rate kill-switch logic.

---

## 9. Admin dashboard — mostly reusable

The admin shell, contacts directory, outreach thread view, readiness checklist, and Stripe order tracking are platform-level. The labels need a sweep.

### Required
- [ ] **`app/admin/layout.tsx`** — sidebar nav labels. "Listings" / "Outreach" / "Postcards" / "Campaigns" / "Leads" — rename "Listings" if the merchant's primary entity isn't a listing (it's a "client" / "case" / "deal").
- [ ] **`components/admin/readiness-checklist.tsx`** — line items reference NAR, Lob postcards, Twilio, Resend, etc. Remove the items that don't apply; add new ones for any new APIs.

### Don't touch
- Admin auth gate (`middleware.ts`, `app/admin/actions.ts`, `app/admin/campaigns/actions.ts`) — just update the `ADMIN_EMAIL_DOMAINS` default if the new operator's email domain differs.
- `/admin/outreach`, `/admin/contacts`, `/admin/orders` — generic.

---

## 10. DB schema — rename a few columns, leave the rest

`db/schema.ts` is mostly platform; a few columns leak vertical assumptions.

### Probably rename (per merchant)
- `listings.agentEmail` → `primaryContactEmail`
- `listings.agentName` → `primaryContactName`
- `listings.agentPhone` → `primaryContactPhone`
- `listings.brokerage` → `primaryContactCompany` (or drop)
- `listings.mlsId` → drop or rename to `externalId`
- `listings.photos` → `attachments` if the merchant works on something other than photos
- `listings.floorplanRecommendations` / `floorplanSourceUrl` → drop unless analogous
- The `listing_source` enum — rename values to match new sources

### Don't touch
- `outreach_events`, `messages`, `orders`, `previews`, `admin_settings`, `agent_costs`, `contractor_*` tables. They are merchant-agnostic — **especially `outreach_events`**, which is the universal "any cold or transactional send" log.

> **Migration approach**: write the rename as a SQL migration in `db/migrations/` AND update `db/schema.ts`. Run via `drizzle-kit push` (or directly via psql for one-offs). Update every reference in code in the same PR.

---

## 11. Inngest event schema — keep, extend if needed

`inngest/client.ts` defines the event schema. The current events (`listings/ingested`, `listings/qualified`, `preview/ready`, `outreach/sent`, `orders/paid`, `orders/fulfilled`, `inbound/email`, `self-serve/submitted`, `lead/captured`, `discovery/manual`) are merchant-agnostic.

### Required
- [ ] No edits, unless the new merchant introduces a new event type. If it does, add it to `inngest/client.ts` and register the new function in `app/api/inngest/route.ts`.

---

## 12. Sample data + seeds — wipe before launch

- [ ] **DB**: `truncate listings, previews, outreach_events, messages, orders, contractor_leads, contractor_intros cascade;` to clear Realscale's data.
- [ ] **R2**: keep `samples/services/*` only for the services the new merchant offers (overwrite via the regenerated samples script). Delete legacy keys.
- [ ] **`scripts/seed-listing.ts`** — replace seed data with a new-merchant-relevant test row.
- [ ] **`scripts/check-state.mjs`, `demo-outreach.mjs`, `force-push-preview.mjs`, `repro-qualification.mjs`** — debug scripts that may reference vertical-specific test data. Update or delete.

---

## 13. Required env vars — full list per merchant

Copy `.env.example` to your local + Vercel. The full list (current as of 2026-04-27):

**Universal — every merchant needs these**
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `SUPPORT_EMAIL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_*_URL`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_INBOUND_WEBHOOK_SECRET`, `SENDER_DOMAINS`, `SENDER_FROM_NAME`, `REPLIES_EMAIL`
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- `ADMIN_EMAIL`, `ADMIN_EMAIL_DOMAINS`
- `ANTHROPIC_API_KEY` (email drafting + reply triage)
- `POSTHOG_PROJECT_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- `DAILY_SEND_CAP`, `PREVIEW_DAILY_CAP`, `FULFILLMENT_DAILY_BUDGET_CENTS`

**Per-merchant (depending on what's in the catalog)**
- `FAL_API_KEY` (image generation — drop if merchant generates text/PDF/audio instead)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (only if any service uses satellite tiles)
- `APIFY_TOKEN` + `APIFY_*_ACTOR` (only if scraping)
- `ATTOM_API_KEY` / `PROPERTYRADAR_API_KEY` (real-estate property data — drop)
- `APOLLO_API_KEY` / `HUNTER_API_KEY` (skiptracing — keep if cold B2C)
- `YELP_API_KEY` (only if Yelp is the partner directory)
- `LOB_API_KEY` (only if direct mail is part of outreach)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` (only if SMS — needs A2P 10DLC + EIN)
- `HOMEOWNER_DISCOVERY_ZIPS` / `HOMEOWNER_DISCOVERY_LIMIT` (only if homeowner-style cold cron)
- `CONTRACTOR_REFERRAL_FEE_USD` (only if marketplace side)

---

## 14. Deploy + verify — the 10-minute final pass

After all the above:

- [ ] `npx tsc --noEmit` passes locally
- [ ] `vercel deploy --prod` succeeds
- [ ] `/admin` sign-in works for the operator
- [ ] `/admin` readiness checklist shows green (all required env vars detected)
- [ ] Hit `/api/admin/trigger?target=realtor` (rename the param if the new merchant uses different funnel terminology) → Inngest dashboard shows the discovery run, listings appear in `/admin/listings`
- [ ] Trigger one self-serve flow end-to-end: paste an input on the site → preview generates → `/l/<slug>` renders → checkout works in Stripe live
- [ ] Send one test outreach email to your own address → confirm verified domain, footer correct, unsubscribe link works
- [ ] Inbound webhook: reply to the test email → confirm `/admin/outreach/<id>` shows the inbound + auto-classification
- [ ] Stripe webhook: complete a test purchase → orders/paid fires → fulfillment runs → delivery email + zip arrive

If all 8 verifications pass, the merchant is live.

---

## 15. What to lift up (when you do this twice and it hurts)

After 2-3 forks, the duplicated edits will form a clear pattern. The natural next refactor is to extract this list of changes into:

- A `merchant.config.ts` at the repo root (services, prompts, audiences, scoring, sources, copy keys)
- A `@zilla/platform` package with everything in §6, §9, §10 (don't-touch), §11
- Per-merchant apps that import `@zilla/platform` and ship only their config + page copy

That's option **#2 (monorepo with platform package)** from the templatization options. Don't do it preemptively — let real duplication tell you which abstractions are worth the cost.
