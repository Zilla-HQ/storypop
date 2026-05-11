# UGC.md — User-generated content brief

Scripts you give creators when they post about your merchant. Tight constraints + a copy template that gives them latitude.

## The brief

When you onboard a sponsored creator, give them this brief (port + adapt per merchant):

---

**Goal:** show one customer (or a fictional stand-in if needed for privacy) going from "I need a website" → "Hey, I have a website" in 30 seconds.

**Format:** 30-second vertical (9:16) TikTok / Reel / Short.

**Required:**
- Show the actual product: a real website you ordered (we'll ship one to you for free).
- Show the price visibly at some point: "$199 once" on screen for at least 1 second.
- Audio: your normal voice, no copyright music.
- One on-screen text block: the customer's pain point in their own words.
- End frame: "Link in bio" or "Search <BRAND_NAME>".

**Avoid:**
- Lip-sync trends.
- Excessive "ad-feel" graphics.
- Hashtag spam (>5 hashtags).
- Saying you "love" the product unless you've actually used it.

**Provide:**
- Stats from your audience: where they live, what businesses they run.
- A draft caption + 3 hashtag options.
- Posting time you plan (so we don't run a paid ad on the same handle the same hour).

---

## Pre-shipping checklist (operator side)

Before sending the brief, run through:

- [ ] Sponsor-send cron has marked the creator's contact `status='won'`.
- [ ] Creator's preferred handle / link is in `outbound_contacts.notes`.
- [ ] Free product order created in Stripe (manual coupon code: `CREATOR_<HANDLE>`).
- [ ] Affiliate code minted: `<HANDLE>` is now a referral code in `referrals`.
- [ ] Brief sent via `outbound_contact_messages` (auto-threaded in the sponsor inbox).

## When to re-engage

Treat creators on a 90-day cycle:

- **0–90 days from first post:** track conversions via their affiliate link. Pay out monthly per the `lib/affiliate.ts` ladder.
- **Day 90:** if their affiliate sales ≥ 2, send a "let's do it again — pick a vertical" message. Tier them up.
- **Day 90 with zero sales:** mark `status='archived'` and don't re-engage. Their audience isn't the right shape.

## Avoid

- Cross-promo with creators in adjacent but not identical verticals (a yoga creator posting about a dental product). Conversion drops to noise.
- Mass-DM creator outreach via the same merchant handle that runs the autoreplies — the brand account looks spammy. Use `partners.<merchant-domain>` instead.
- Asking for specific post content (script, music, frames). Creators who feel boxed in produce stilted content; their value is voice + audience, not your script.
