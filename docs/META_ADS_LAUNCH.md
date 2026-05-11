# Restay — Meta Ads launch checklist

Operator's punch list. Code in this repo handles everything except the Meta
Business UI work flagged below. Reference: `Zilla-HQ/merchant-template/META_ADS.md`.

---

## Status snapshot

**Already in repo** (`feat(admin): live Meta Ads insights panel` and earlier):

- Browser pixel snippet (`components/marketing/ad-pixels.tsx`)
- `NEXT_PUBLIC_META_PIXEL_ID = 1674051237271433`
- `META_CAPI_ACCESS_TOKEN` (Conversions API, scope `read_ads_dataset_quality`)
- `lib/meta-ads.ts` — read-only insights snapshot
- Admin "Meta Ads (live)" panel at `/admin`

**Just added** (this branch):

- `lib/meta-capi.ts` — server-side CAPI sender (hashed user_data, fbp/fbc passthrough, dedupe)
- `lib/track-meta-event.ts` — browser helper with the `trackCustom` guard
- CAPI events wired into `/api/self-serve` (Lead), `/api/checkout` (InitiateCheckout), `/api/stripe/webhook` (Purchase)
- `scripts/meta-capi-verify.ts` — smoke-tests CAPI against the Test Events tab
- `scripts/meta-launch-campaign.ts` — programmatic CBO campaign + 2 ad sets
- `scripts/meta-upload-page-video.ts` — chunked video upload to Page (single endpoint hangs with System User tokens)
- `scripts/meta-create-ads.ts` — 4 copy variants × 2 ad sets = 8 ads
- `scripts/meta-test-lead-scaler.ts` — read-only dry-run of the budget cron
- `inngest/functions/meta-ads-lead-scaler.ts` — daily 1:30am UTC, stateless budget bumps + CAC pause
- `inngest/functions/meta-ads-fatigue-check.ts` — daily 9am UTC, flags freq > 2.5

---

## Step 1 — Meta Business UI work (only you can do this)

### 1a. Create a System User token with the right scopes

The current `META_CAPI_ACCESS_TOKEN` is CAPI-only (`read_ads_dataset_quality`).
It cannot create campaigns, upload videos, or change budgets. Generate a
separate token:

1. **business.facebook.com** → Business Settings → **Users → System Users → Add**
2. Name: `restay-server`, role **Admin**
3. **Add Assets** to that user — assign all four:
   - Ad accounts → your Restay ad account → toggle **Manage campaigns**
   - Pages → your Restay Page → toggle **Create content** (or Manage Page)
   - Datasets and pixels → Restay pixel (`1674051237271433`) → **Manage Pixel**
   - Apps → your Meta app → **Develop app**
4. **Generate New Token** → check all five scopes:
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_manage_posts`
   - `pages_read_engagement`
5. Set in Vercel env: `META_ADS_ACCESS_TOKEN=<token>` (production AND preview)

### 1b. Confirm the Meta app is in Live mode (not Development)

If your Meta app is in Development mode, **ad creatives sharing API-uploaded
videos will fail to create.** Most ad-creative API errors trace to this.

1. https://developers.facebook.com/apps → your app → Settings → Basic
2. Fill: Privacy Policy URL = `https://restay.agency/privacy` (already shipped),
   App Icon (1024×1024 PNG), Category = "Business and Pages", Data Deletion =
   "Email hello@restay.agency"
3. Save → top of dashboard: flip **App Mode → Live**

Live mode does NOT require Meta App Review for advertising-only use cases.

### 1c. Connect Pixel to ad account at Manage level

1. Business Settings → Data Sources → **Datasets and pixels** → Restay pixel
2. **Connected Assets** tab → Add → your ad account
3. **Toggle "Manage Pixel"** — NOT just Track. Track-only causes
   `Account does not have access to pixel` at ad-creation time.

### 1d. Generate a Conversions API token (separate from Marketing API)

The current `META_CAPI_ACCESS_TOKEN` is fine for CAPI, but its scope is now
known (`read_ads_dataset_quality`) and you'll want a fresh dedicated CAPI
token to keep the two roles cleanly separated:

1. Events Manager → Restay pixel → Settings → Conversions API → **Generate access token**
2. Vercel env: `META_CONVERSIONS_API_TOKEN=<token>`
   (`lib/meta-capi.ts` reads this first, falling back to `META_CAPI_ACCESS_TOKEN`.)

### 1e. Note these IDs from Business Settings

- **Ad account ID** (numeric, with `act_` prefix) → `META_AD_ACCOUNT_ID`
- **Page ID** (numeric) → `META_PAGE_ID`
- **Instagram actor ID** (numeric, optional but recommended for IG branding) → `META_INSTAGRAM_ACTOR_ID`
- **Test Events code** (Events Manager → Pixel → Test Events tab) → `META_TEST_EVENT_CODE` (optional)

---

## Step 2 — Verify CAPI works end-to-end

Once `META_TEST_EVENT_CODE` is set:

```bash
npx tsx --env-file=.env.local scripts/meta-capi-verify.ts TEST<NNNNN>
```

You should see all 5 events (PageView / ViewContent / Lead / InitiateCheckout
/ Purchase) appear in Events Manager → Test Events within ~30s. Match-quality
score should be 6+ for the Purchase event (we send hashed email + IP + UA).

---

## Step 3 — Launch the campaign

```bash
# 1. Create campaign + 2 ad sets (all PAUSED, OUTCOME_LEADS, $75/day CBO).
npx tsx --env-file=.env.local scripts/meta-launch-campaign.ts
# → prints campaign_id, adset_a_id, adset_b_id

# 2. Set the IDs in Vercel env, then in .env.local:
#    META_LEAD_CAMPAIGN_ID=<campaign>
#    META_LEAD_ADSET_A_ID=<adset_a>
#    META_LEAD_ADSET_B_ID=<adset_b>
#    META_LEAD_LAUNCH_DATE=2026-05-05  (today)

# 3. Record a 15-30s vertical 9:16 screen-recording of the Restay flow
#    on a real listing, export 1080×1920 H.264 MP4.

# 4. Upload it to the Page (chunked).
npx tsx --env-file=.env.local scripts/meta-upload-page-video.ts ./creative-v1.mp4
# → prints video_id

# 5. Create 4 copy variants × 2 ad sets = 8 ads (PAUSED). Edit the VARIANTS
#    constant in scripts/meta-create-ads.ts first if you want different copy.
npx tsx --env-file=.env.local scripts/meta-create-ads.ts <video_id>
```

### Spot-check before unpausing

1. Ads Manager → click each ad → Preview pane → confirm:
   - video plays
   - copy renders
   - CTA button correct
   - destination URL has UTMs (`utm_source=meta&utm_medium=paid_social...`)
2. Unpause IN ORDER: campaign → ad sets → ads. Meta warns if you flip a
   child ACTIVE while the parent is PAUSED.
3. Most ads sit in `PENDING_REVIEW` for 30-60 min before they start spending.

---

## Step 4 — Crons take over

After launch the Inngest crons run automatically:

| Cron | When | What |
|---|---|---|
| `meta-ads-lead-scaler` | 1:30am UTC daily | Targets `$75 × 1.2^floor(days/3)`, capped at `$200`. Pauses if 7d CAC > `$7` (early) / `$5` (steady) after $50+ spend. Stateless — launch date is the only source of truth. |
| `meta-ads-fatigue-check` | 9am UTC daily | Logs ads with last-7d frequency > 2.5. Doesn't auto-pause; surfaces the signal. |

Smoke-test the scaler at any time:

```bash
npx tsx --env-file=.env.local scripts/meta-test-lead-scaler.ts
```

Read-only — prints what the scaler WOULD do today.

---

## Operating cadence (week-by-week)

- **Day 0–3**: don't panic. CTR/CPC stabilize. Probably 0 Leads yet.
- **Day 4–6**: first Leads. Auto-scaler starts bumping budget +20% every 3 days.
- **Day 7**: first checkpoint. Kill ads with `BELOW_AVERAGE` ranking on quality OR engagement.
- **Day 14**: CAC ceiling tightens to `$5`. Real economics test.
- **Day 15+**: scale-or-kill. If CAC < $5 with healthy volume, let it ride.
  If hovering at ceiling, refresh creative. If > $5 with no obvious fix, kill.
- **Refresh creative every ~2 weeks** on winners. Frequency > 2.5 = burn money.

### Kill criteria — write these down, hold yourself to them

- Ad: ranking BELOW_AVERAGE on quality OR engagement → kill
- Ad set: CTR < 50% of campaign avg after $50 spent → kill
- Ad set: CAC > target × 1.5 after 30+ events → kill
- Ad: frequency > 3 with no fresh creative → refresh or kill

---

## Env var summary

```bash
# Pixel + CAPI (already set in .env.local for the most part)
NEXT_PUBLIC_META_PIXEL_ID=1674051237271433
META_CONVERSIONS_API_TOKEN=...           # NEW — separate from CAPI legacy token
META_TEST_EVENT_CODE=TEST12345           # OPTIONAL — only for staging verify

# Marketing API — NEW token with all 5 ads scopes
META_ADS_ACCESS_TOKEN=...                # System User token (1a)
META_AD_ACCOUNT_ID=act_xxxxxxxxxx        # Ad account ID with act_ prefix
META_PAGE_ID=xxxxxxxxxx                  # Restay FB Page ID
META_INSTAGRAM_ACTOR_ID=xxxxxxxxxx       # OPTIONAL — IG actor for ads to run on IG too

# Set after running scripts/meta-launch-campaign.ts
META_LEAD_CAMPAIGN_ID=...
META_LEAD_ADSET_A_ID=...
META_LEAD_ADSET_B_ID=...
META_LEAD_LAUNCH_DATE=2026-05-05         # YYYY-MM-DD; scaler reads this

# Optional scaler tuning (defaults shown)
META_LEAD_INITIAL_BUDGET_CENTS=7500
META_LEAD_MAX_BUDGET_CENTS=20000
META_LEAD_CAC_CEILING_EARLY=7
META_LEAD_CAC_CEILING_STEADY=5
META_LEAD_MIN_SPEND=50
META_LEAD_FATIGUE_FREQUENCY=2.5
CRON_LEAD_SCALER_ENABLED=true
CRON_FATIGUE_CHECK_ENABLED=true
```
