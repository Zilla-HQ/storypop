# Reddit Ads — manual setup

Reddit Ads API requires per-account OAuth + developer registration that I can't do programmatically. Here's the exact 15-min UI setup for a $20-30/day test campaign that will give us a 4th channel signal.

## Why Reddit Ads for Restay

- r/AirBnB has 800k+ members, ~80% English-speaking US/UK, almost entirely hosts and guests of Airbnb listings — exactly our ICP.
- Reddit Ads CPCs run $0.50–1.50 typically (cheaper than Meta's $1.10 in our account).
- Auction is less crowded than Meta — fewer big advertisers compete for STR-host audience.
- Subreddit-targeted promoted posts can have 5-15% engagement rates if the copy reads native (vs. ad-y).

## Setup steps

### 1. Open Reddit Ads at <https://ads.reddit.com>

Sign in with the same Reddit account you'll be running ads from. Create a new ad account if it's the first time.

### 2. Add Reddit Pixel (already wired)

Skip — `NEXT_PUBLIC_REDDIT_PIXEL_ID` is already firing on restay.agency. Verify in Reddit Ads → Events Manager. You should see PageView events.

If not firing: check that `<RedditPixel>` component renders in `app/layout.tsx`.

### 3. Create campaign

- **Objective:** Traffic
- **Name:** `Restay — Reddit test v1 — 2026-05`
- **Daily budget:** $25/day
- **Bid strategy:** Maximum delivery (auto-bid)

### 4. Targeting

- **Communities** (subreddits):
  - r/AirBnB
  - r/airbnb_hosts
  - r/Superhost
  - r/realestateinvesting
  - r/sidehustle (broader; cheaper impressions)
- **Locations:** United States, Canada, United Kingdom, Australia
- **Age:** 25–65
- **Devices:** All
- **Time of day:** All

### 5. Creative — Promoted Post

**Headline:** Free Airbnb listing grader — paste your URL, get a 0-100 score in 10 seconds

**Description:** Built this because most Airbnb optimization tools are subscription. This one's free for the score, $79 one-time if you want the work done. No signup. restay.agency/grade

**CTA:** Visit Site

**Destination URL:** `https://restay.agency/grade?utm_source=reddit&utm_medium=paid_social&utm_campaign=test_v1`

**Image:** Use the same hero image as the Meta winner (download from Meta Ads Manager: ad ID `52544550069592` → creative download).

### 6. Tracking

Reddit doesn't natively support UTM via their UI — pass UTMs via the destination URL above, then read them off the `utm_source=reddit` query param in our middleware.ts attribution capture (already wired).

### 7. Stop-loss

If after $50 spent (~2 days at $25/day) we have:
- 0 sample-email signups (`/grade` form completion via reddit UTM) → pause, the audience isn't converting
- 1+ sample-email signups → bump to $50/day
- 1+ paid order → bump to $100/day

## Optional: r/AirBnB native organic post FIRST

Before the paid test, post the long-form FB-group draft from `docs/outreach/reddit-fb-plays.md` to r/AirBnB *organically*. If it gets engagement, the same copy as a paid Promoted Post will perform 2-3× better than starting cold. Use a Reddit account with ≥3 weeks of karma — fresh accounts get auto-flagged.
