# ENRICHMENT — finding email addresses when the platform proxies contact

Most merchants in this template send cold email to recipients whose email addresses are publicly attached to public records (real-estate agents on MLS feeds, SMB owners listed in Yelp/Google profiles, podcast hosts with `hello@<podcastdomain>`). For those merchants, the template's existing enrichment loop is enough: `lib/skiptrace.ts` (Hunter + Apollo) + the `backfill-emails` cron.

This doc covers the harder case: **the recipient's contact is proxied by a platform.** Airbnb proxies all host emails. Instagram proxies all creator emails. TaskRabbit/Uber/DoorDash proxy gig-worker emails. StubHub proxies seller emails. The cold-outbound recipient is reachable on the platform itself, but not directly. The template's existing Hunter+Apollo loop returns ~0% on these — they're not in business-email databases.

Restay (Airbnb listing optimization) is the reference. The pattern below works for any platform-proxied vertical.

---

## The 5-step pipeline

Each step tries to identify the recipient via a different signal. Steps are tried in order; first hit wins.

```ts
// lib/<recipient>-enrich.ts — sketch
export async function enrichRecipientEmail(listing: Listing): Promise<EnrichmentResult> {
  // Step 1: regex the listing description for a personal website / Instagram handle / business name
  const step1 = await regexListingDescription(listing.description);
  if (step1.email) return { email: step1.email, source: "listing_regex" };

  // Step 2: Hunter.io domain → email match (when step 1 surfaced a domain)
  if (step1.domain) {
    const step2 = await hunterDomainLookup(step1.domain, listing.recipientName);
    if (step2.email) return { email: step2.email, source: "hunter_domain" };
  }

  // Step 3: cross-reference recipient name + city against jurisdictional permit / license registries
  const step3 = await registryLookup(listing.recipientName, listing.city);
  if (step3.email) return { email: step3.email, source: "registry" };

  // Step 4: reverse-image search of listing photos → property management / agency website
  const step4 = await reverseImageSearch(listing.photos);
  if (step4.email) return { email: step4.email, source: "reverse_image" };

  // Step 5: fallback — submit through the platform's contact form (rate-limited, trackable)
  return { email: null, source: "platform_form", platformFormUrl: listing.contactFormUrl };
}
```

**Realistic match rates (from Restay):**
- Single-property hosts: **25–40%** through steps 1–4
- Multi-listing hosts (i.e. operators with 3+ listings): **60–80%** — these tend to have a brand, a website, and a discoverable domain

If you're matching < 20% on a fresh vertical, the pipeline isn't broken — the population just isn't business-y enough. Focus discovery on the multi-listing / power-seller cohort first; build proof; expand later.

---

## Step 1 — Regex listing description for personal website / Instagram / business name

The cheapest step and the highest yield. Power-user recipients almost always sneak around the platform's anti-contact rules:

- *"Our family runs hostsforyou.com, message there for faster replies"*
- *"@aurora_stays_nashville on IG"*
- *"Owned and operated by Aurora Hosting LLC"*

What to extract:
- Domain (regex: `\b[a-z0-9-]+\.[a-z]{2,}\b` minus a blocklist of platform domains, social platforms, common false-positives)
- Instagram handle (regex: `@[a-zA-Z0-9._]+` or `instagram\.com/[a-zA-Z0-9._]+`)
- Business name (capitalized 2+ word noun phrases — fuzzy, use Claude with a temperature-0 extraction prompt if regex is noisy)

**Files:**
- `lib/host-enrich.ts:regexListingDescription()` in Restay

**Gotchas:**
- The domain regex will catch `airbnb.com` / `instagram.com` / `youtube.com` — blocklist these.
- Some operators write their email as `aurora [at] hostsforyou [dot] com` — handle the common obfuscations.
- "Aurora Hosting LLC" is searchable in step 3 even without a domain.

---

## Step 2 — Hunter.io domain → email match

If step 1 surfaced a domain, Hunter.io's domain-search API returns the verified emails on that domain. Pair the result with the recipient name extracted from the listing for the strongest match:

```ts
const result = await hunter.domainSearch({ domain });
const matched = result.emails.find(e => e.first_name?.toLowerCase() === recipientFirstName.toLowerCase());
if (matched && matched.confidence > 70) return { email: matched.value };
```

**Pricing:** Hunter free tier is 25 searches/month — far too low for production. Paid tier starts at $49/mo for 1,000 searches. **Reserve Hunter calls for step-1 hits only** — never burn quota on un-domained listings.

**Files:**
- `lib/skiptrace.ts:hunterDomainLookup()` in the template

---

## Step 3 — Jurisdictional registry cross-reference

Many cities publish public registries that contain owner contact info for the regulated activity. For Restay (STR / Airbnb), these are city-level **short-term-rental permit registries**:

- Nashville: short-term rental permit register (CSV download, contains owner email)
- Austin: STR permit map (per-permit detail page contains owner contact)
- NYC: rental registration list (similar)
- SF: STR registry
- Honolulu, Portland, Charleston, Asheville, Park City, Joshua Tree all publish similar

For other verticals:

| Vertical | Registry |
|---|---|
| Real-estate agents | State real-estate licensing board (every US state publishes; usually a CSV or HTML scrape) |
| Lawyers | State bar association directory |
| Doctors | NPI (National Provider Identifier) registry |
| Restaurants | County health-department food-permit list |
| Contractors | State contractor licensing board |
| Real-estate appraisers | NRDS / state appraiser board |
| Auctioneers, plumbers, electricians, beauticians, etc. | State occupational licensing |

**Implementation pattern in Restay:**

```ts
// lib/registries/<city-slug>.ts — one file per registry
export async function lookupNashvilleSTRPermit(name: string, address?: string) {
  // Fetch (cached) registry CSV
  const rows = await fetchRegistryCsv("nashville-str");
  // Fuzzy match name + address
  const match = rows.find(r => fuzzyName(r.owner) === fuzzyName(name) && (!address || sameStreet(r.address, address)));
  return match ? { email: match.email } : null;
}
```

**Gotchas:**
- Registry CSVs change column names yearly. Add a CI check that fails the deploy if the expected columns are missing.
- Some registries publish only owner *name*, not email — combine with step 2 (Hunter on the owner's business name).
- Registry-coverage varies wildly by jurisdiction. Restay covers ~12 cities; the other 35+ STR cities fall through to step 4 or 5.

---

## Step 4 — Reverse-image search

Power-user listings often re-use photography from the operator's primary website (their PM company's listing page, their booking platform like Hostfully, their direct-booking site). Reverse-image search of the listing photos surfaces the operator's primary domain → run step 2 (Hunter) on that domain.

**APIs:**
- TinEye API (~$0.05 per search; reliable)
- SerpAPI's Google Reverse Image endpoint (~$0.10 per search; richer results)

**Files:**
- Stubbed in Restay's `lib/host-enrich.ts` under TODO; not yet wired to TinEye in production. Plan: enable for multi-listing hosts only (the cost is small, the conversion uplift is meaningful on operators).

**Gotchas:**
- Most single-property hosts upload originals. Reverse image returns nothing — expected.
- The match must point to an *operator's site*, not a competing OTA. Filter results by domain category before passing to step 2.

---

## Step 5 — Platform contact form fallback

When all enrichment fails (~30–50% of single-property cold leads), the last option is to submit through the platform's own "contact host" / "message creator" form. This is **rate-limited at the platform level** — Airbnb caps unauthenticated form submissions per IP per day, Instagram caps creator DMs harder, gig platforms cap per session.

**Implementation pattern:**
- Browser-automation (Playwright + rotating residential proxies) — expensive and fragile, but for high-value leads (Premium tier; tier-1 affiliates) it's worth it.
- Tracked as `outreach_events.channel = "platform_form"` so it counts toward the daily send cap and shows in the operator dashboard.
- Do *not* impersonate a customer — submit through the form, sign with the merchant's name, link to the merchant's landing page. The form is just a transport.

**When to skip step 5:**
- If the merchant's positioning makes platform-form submissions look spammy (e.g. a B2B service contacting consumer hosts through a customer-form).
- If the platform's TOS explicitly forbids commercial use of the contact form (Airbnb's does for "commercial solicitation"; submit with caution and only for warm-warm leads, never cold-batch).

---

## Database schema

The enrichment metadata should be persisted on `listings`:

```ts
// db/schema.ts
listings = {
  // ...
  recipientEmail: text("recipient_email"),
  recipientEmailSource: text("recipient_email_source"),  // "listing_regex" | "hunter_domain" | "registry" | "reverse_image" | "platform_form" | null
  recipientEmailConfidence: integer("recipient_email_confidence"),  // 0-100, Hunter-style score
  enrichmentAttemptedAt: timestamp("enrichment_attempted_at"),
  enrichmentLastError: text("enrichment_last_error"),
}
```

This makes downstream analysis tractable: *what's our conversion rate by enrichment source?* (Almost always: registry > hunter > regex >> form-submission.)

---

## Files to copy from `Zilla-HQ/airbnb`

| File | Purpose |
|---|---|
| `lib/host-enrich.ts` | Top-level orchestrator; routes through steps 1–5 |
| `lib/registries/` | One file per jurisdictional registry (Nashville, Austin, etc.) |
| `lib/skiptrace.ts` | Already in template — Hunter + Apollo wrappers |
| `inngest/functions/backfill-emails.ts` | Already in template — manual-only cron that re-runs enrichment on listings missing emails |
| Per-tier batch send scripts | See [RESTAY.md §Domain warm-up ramp](./RESTAY.md#domain-warm-up-ramp) — these are the consumers of enrichment results |

---

## Compliance reminder

Whatever path enrichment took, the **send still goes through `lib/resend.ts:sendComplianceEmail`** and is gated by `lib/state-optout.ts`. Platform-form submissions count too — track them in `outreach_events` so unsubscribes apply. The enrichment doesn't relax compliance; it just finds the address.

---

## When the pipeline still returns nothing

Some recipients are genuinely un-findable from public data. The fallback options:

1. **Hard-filter discovery** to only include recipients where step 1 surfaced *something* — accept the lower volume in exchange for higher reply rates.
2. **Layer in paid acquisition** (`META_ADS.md`, `GOOGLE_ADS.md`) so the unenrichable cohort can self-identify by clicking the ad.
3. **Add a referral / affiliate program** ([PARTNERS.md](./PARTNERS.md)) so the un-cold-emailable cohort can be reached through human networks.

The "enrichment failure rate" is the *floor* on how much paid + content you have to do. Restay's 25–40% match rate on single-property hosts means ~60% of the discoverable pool requires another channel. Sitebeat's higher rate (mostly SMBs with domains) requires less.
