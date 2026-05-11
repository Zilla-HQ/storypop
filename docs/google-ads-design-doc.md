# Zilla HQ — Google Ads API Tool Design Document

**Submitted by:** Zilla HQ
**Contact:** jack@seifdn.org
**Manager Account ID:** 3797064633
**Date:** 2026-05-06
**Tool category:** Internal marketing automation (employees only)

---

## 1. Overview

Zilla HQ is a portfolio operator that builds vertical-specific software-as-a-service products. The first portfolio brand, **Restay** (https://restay.agency), provides one-time Airbnb listing optimization for individual hosts. Future portfolio brands will target adjacent vertical markets (real estate listing optimization, e-commerce SEO, etc.) under the same operational model.

The tool described here is an **internal Google Ads management script + Inngest cron** used by the Zilla HQ team (one operator: jack@seifdn.org) to:

1. Programmatically create branded-defense Search campaigns when a new portfolio brand launches.
2. Manage daily campaign budgets via an autonomous scaler that reads campaign performance and adjusts within configured floor/ceiling values.
3. Sync campaign metrics hourly to our internal admin dashboard for monitoring.

The tool is **not customer-facing**. No external user, partner, or third party will ever authenticate against the Google Ads API through this tool. All operations target ad accounts that are directly linked to the Zilla HQ Manager Account (3797064633) and owned by the same business entity.

---

## 2. Architecture

### 2.1 Components

| Component | Where it runs | Purpose |
|---|---|---|
| `scripts/google-ads-launch-branded.ts` | Operator's local machine (one-shot, on fork to new merchant) | Creates campaign + ad group + RSA + sitelinks + callouts + conversion action |
| `inngest/functions/google-ads-budget-scaler.ts` | Vercel + Inngest cron (daily 1:30 AM UTC) | Reads last-7-day spend/conversions; adjusts daily budget within configured bounds |
| `inngest/functions/google-ads-sync.ts` | Vercel + Inngest cron (hourly) | Pulls Insights data; surfaces in admin dashboard at /admin |
| `app/admin/page.tsx` | Vercel (server-rendered) | Read-only display of synced metrics — operator monitoring only |
| `lib/google-ads.ts` | Vercel (called by the above) | Thin REST client around `googleads.googleapis.com/v20/...` |

### 2.2 Authentication flow

```
Operator's local machine (one-time):
  scripts/google-ads-mint-refresh-token.ts
    │
    ├── Spawns local OAuth callback server on http://localhost:RANDOM_PORT
    ├── Opens browser to Google's OAuth consent (scope: adwords)
    ├── Operator (jack@seifdn.org) signs in and approves
    ├── Receives auth code, exchanges for refresh_token
    └── Operator copies refresh_token into Vercel env (GOOGLE_ADS_REFRESH_TOKEN)

Server runtime (every API call):
  Inngest cron / admin page handler
    │
    ├── Reads refresh_token from env
    ├── POSTs to oauth2.googleapis.com/token (grant_type=refresh_token)
    │     → mints short-lived access_token (~1 hour)
    ├── Calls googleads.googleapis.com/v20/customers/<cid>/...
    │     Headers:
    │       Authorization: Bearer <access_token>
    │       developer-token: <our token>
    │       login-customer-id: 3797064633   (Zilla HQ MCC)
    └── Parses JSON response, updates internal database / dashboard
```

### 2.3 API endpoints used

The tool calls only the following Google Ads API endpoints, all on the v20 REST API at `googleads.googleapis.com`:

| Endpoint | Method | Purpose | Frequency |
|---|---|---|---|
| `/customers:listAccessibleCustomers` | GET | Smoke test on credential changes | Manual, ~1×/month |
| `/customers/{cid}/googleAds:searchStream` | POST | Read campaign metrics for the admin dashboard | Hourly per merchant |
| `/customers/{cid}/campaignBudgets:mutate` | POST | Create budget on merchant launch; adjust budget from autonomous scaler | One-time on launch + 1×/day per merchant |
| `/customers/{cid}/campaigns:mutate` | POST | Create branded-defense Search campaign | One-time on merchant launch |
| `/customers/{cid}/adGroups:mutate` | POST | Create ad group inside the campaign | One-time on merchant launch |
| `/customers/{cid}/adGroupCriteria:mutate` | POST | Add exact-match keywords to ad group | One-time on merchant launch |
| `/customers/{cid}/adGroupAds:mutate` | POST | Create Responsive Search Ad with headlines, descriptions, paths | One-time on merchant launch |
| `/customers/{cid}/campaignCriteria:mutate` | POST | Set location targeting (US), language (English), network (Search-only) | One-time on merchant launch |
| `/customers/{cid}/assets:mutate` | POST | Create sitelink + callout assets | One-time on merchant launch |
| `/customers/{cid}/customerAssets:mutate` | POST | Link assets to campaign | One-time on merchant launch |
| `/customers/{cid}/conversionActions:mutate` | POST | Create the Purchase conversion action with URL pattern | One-time on merchant launch |

### 2.4 Estimated quota usage

For one merchant (Restay, currently active):

- **One-time launch:** ~50 ops total (campaign + ad group + RSA + 5 keywords + 4 sitelinks + 8 callouts + conversion action + various criteria mutations).
- **Hourly metrics sync:** 1 searchStream call/hour = 24 ops/day.
- **Daily budget scaler:** 1 searchStream + at most 1 mutate per merchant per day = 2 ops/day.

**Total daily quota usage per merchant: ~26 ops/day.** Well under any access tier's daily quota.

Future projection: at 5 portfolio brands, total usage is ~130 ops/day. Still negligible.

---

## 3. Use case scenarios

### 3.1 Branded-defense campaign launch (one-time per merchant)

When forking the Zilla HQ template to a new portfolio brand:

1. Operator creates a new Google Ads account in the UI for the new brand.
2. Operator links the new ad account to the Zilla HQ Manager Account (3797064633).
3. Operator updates `GOOGLE_ADS_CUSTOMER_ID` in the new merchant's `.env.local` to point at the new ad account.
4. Operator runs `npx tsx scripts/google-ads-launch-branded.ts` once.
5. Script creates: campaign budget ($60/mo), Search campaign (Search-only network, US-only targeting, Manual CPC), single ad group, 5 exact-match keywords + 1 phrase-match keyword (the brand name + variants), Responsive Search Ad with 15 headlines and 4 descriptions, 4 sitelinks, 8 callouts, Purchase conversion action with URL pattern.
6. Campaign is created in **PAUSED** state. Operator spot-checks in the Ads UI before unpausing.

This entire workflow is replicable across portfolio brands without re-implementation.

### 3.2 Daily budget scaling (autonomous)

Inngest cron runs every day at 1:30 AM UTC:

1. Pulls last-7-day cost and conversions for the campaign.
2. If `daily_spend / daily_budget > 0.9` (campaign is hitting the budget cap consistently), increases daily budget by 50% — capped at a configured maximum ($10/day for branded defense, $200/day for category Search if enabled later).
3. If 7-day cost-per-conversion exceeds the configured ceiling and the campaign has spent more than $50 in the last 7 days, pauses the campaign and surfaces an alert in the admin dashboard.
4. Logs the action.

The scaler is **stateless math** — each run derives target budget from days-since-launch + last-7-day metrics. No DB writes; the only source of truth for budget targets is the launch date stored in env vars.

### 3.3 Hourly metrics sync (read-only)

Inngest cron runs every hour:

1. Calls `searchStream` with a GAQL query selecting impressions, clicks, conversions, cost_micros for the last 7 days.
2. Stores the result in a small key-value cache in our database.
3. The admin dashboard at `https://restay.agency/admin` reads from the cache to render a "Google Ads (live)" panel alongside the existing Meta Ads panel.

---

## 4. Compliance and policies

### 4.1 Adherence to Google Ads API Terms of Service

- The tool operates only on ad accounts directly linked to our Manager Account (3797064633). It does not access third-party ad accounts.
- The tool does not perform any scraping, automated competitive intelligence, or bid-rigging operations. It does not query or interact with other advertisers' campaigns.
- The tool respects API rate limits via exponential backoff in `lib/google-ads.ts`. We have not encountered rate-limit errors in testing because our daily ops are far below any quota.
- The tool does not use the API to automate the Google Ads UI or to circumvent any Google Ads UI control.
- The refresh token is stored only in our Vercel environment variables (encrypted at rest by Vercel). It is not logged, transmitted to third parties, or persisted in version control.

### 4.2 No App Conversion Tracking or Remarketing

The tool does **not** use the App Conversion Tracking API or the Remarketing API.

### 4.3 Access controls

- The tool is used only by employees of Zilla HQ. Currently this is one operator (jack@seifdn.org).
- The OAuth client is registered with `User Type: External` in Testing mode in our Google Cloud project, with `jack@seifdn.org` as the only allowlisted Test User. This means even if the Client Secret were leaked, no other Google account could authorize the OAuth flow.
- The Vercel project where the tool runs is locked to the same operator. No external collaborators have access.

### 4.4 Token rotation

Refresh tokens are rotated when:
- The OAuth client secret is regenerated (after suspected exposure).
- A new operator is added to the team and the existing operator's grant should be revoked.

Token rotation is performed via the existing `scripts/google-ads-mint-refresh-token.ts` flow, followed by updating the Vercel env var and redeploying.

---

## 5. Roadmap (for context, not part of current scope)

These are **not** implemented today and are described for transparency only. They will not be activated without a separate review of compliance:

- **YouTube preroll campaigns** — once branded defense is stable, expanding to `advertising_channel_type=VIDEO` campaigns with placement targeting on specific creator channels (e.g., short-term-rental host educators). Same Manager Account, same compliance posture.
- **Customer Match audiences** — once we have 1,000+ paid customers across portfolio brands, uploading hashed email lists for retargeting. Will follow Google's data-handling requirements for Customer Match.
- **Smart bidding migration** — for category Search campaigns (not branded), migrating from Manual CPC to Target CPA once the campaign has 30+ conversions/month. Standard advertiser behavior.

---

## 6. Summary

This tool is a thin internal automation layer over the Google Ads API. It performs:

- Programmatic campaign creation when launching new portfolio brands (one-time per merchant).
- Daily autonomous budget scaling within configured bounds.
- Hourly metrics sync to an internal admin dashboard.

All operations target ad accounts directly linked to our Manager Account (3797064633). Daily quota usage is approximately 26 ops/day per merchant. The tool is internal-only; no third-party authentication or data access is supported.

We are requesting Basic Access to the Google Ads API to enable this internal automation workflow.

---

**Contact for review questions:** jack@seifdn.org
