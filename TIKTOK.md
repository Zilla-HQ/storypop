# TIKTOK.md — Organic + UGC plan

Strategic playbook for using TikTok as an organic acquisition channel. Tactical content cadence + creator outreach pattern.

## When to invest

- Your buyer is in TikTok's audience. Local-SMB owners ARE — but operators-of-businesses age skews 30-55, so target hashtags accordingly.
- You have visual product moments (before/after, the "wow" reveal, the live-build).
- You can ship 3+ posts a week for at least 12 weeks. Below that cadence, the algorithm won't get a signal.

## Cadence (port from SiteGrid)

Weekly:
- **2 organic posts/wk** from the merchant account: build-completion reveals + "agent voice" diary cuts.
- **1 sponsored creator post/wk** (paid via the affiliate program at premium tier OR flat $250–500).

The build-completion post is the highest-converting format. Pattern:

```
Hook (0–2s):    "We just built a website for a dentist in Austin in 24 hours
                  using AI. Watch the before/after."
Body (2–25s):   30 split-screen frames before / after with a single
                  on-screen-text overlay per pair.
CTA (25–30s):    Three-second outro: "$199 once. Link in bio."
```

Hashtags: vertical-tagged + location-tagged. For dental: `#dentist`, `#dentistry`, `#dentalpractice`, `#localbusiness`, `#smallbusiness`, `#websitedesign`.

## Creator outreach

A curated list of vertical-relevant creators (dentist-influencer, gym-owner-influencer, etc) seeded into `outbound_contacts` with `kind='partner'` and a custom template (e.g. `partner_creator`). The sponsor-send cron handles outreach automatically once `SPONSOR_OUTREACH_ENABLED=true`.

Compensation:
- **Cash** for a one-off post: $250–$1500 depending on follower count, with a 30-day attribution window.
- **Tier-1 affiliate** (no cap on commissions) if they prefer revenue share.
- **Hybrid:** small upfront ($150) + 20% commission for 90 days.

For each creator, record in their `outbound_contacts.notes`:
- Their typical post format.
- Their last successful sponsor.
- A talking point that's relevant to your product specifically (not generic).

## Verified creator list

Maintain `content/creators.md` (manually curated, by vertical) as a flat markdown file:

```markdown
## Dental
- @dr.example — 124k followers — fee:$500/post — last sponsor:smile-club — Apr 2026
- ...

## Fitness  
- ...
```

**Do not fabricate handles.** SiteGrid shipped a creators list with auto-generated handles once and burned a week of operator time chasing accounts that didn't exist. Always verify the handle resolves before adding.

## Avoid

- Lip-synced trends with no relation to the product. Engagement spikes, conversions don't.
- Faking the customer voice. If the customer didn't make the testimonial, the testimonial is fake. Show the agent talking + the work, not a fictional customer.
- Buying followers. The algorithm penalizes accounts whose engagement-to-follower ratio drops after a follower spike.

## Measuring

Per-post tracking:
- Custom UTM in bio link or one-link-per-creator (`merchant.example/ref/<creator-handle>`).
- TikTok pixel on the landing page (if you can install it).
- Manual count: views, likes, comments, profile visits, link clicks (TikTok analytics).

Promote a creator to a recurring deal only when they cross **2 attributed sales in a 30-day window**. Below that, treat each engagement as one-off.
