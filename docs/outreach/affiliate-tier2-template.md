# Affiliate Tier-2 — bulk-but-personal cold-email template for 50 mid-tier creators

**Send from `partners@{{MERCHANT}}.tld`** (see [PARTNERS.md](../../PARTNERS.md)). 50 sends over 5 days, ~10/day staggered.

Goal: 5+ replies of 50. < 3 = the offer isn't strong enough or the list isn't ICP-aligned.

> **Reference:** Restay's filled-in version lives at [`Zilla-HQ/airbnb/docs/outreach/affiliate-tier2.md`](https://github.com/Zilla-HQ/airbnb/blob/main/docs/outreach/affiliate-tier2.md) + [`affiliate-tier2-list.md`](https://github.com/Zilla-HQ/airbnb/blob/main/docs/outreach/affiliate-tier2-list.md) with 50 named mid-tier coaches.

---

## The template

```
Subject: {{Personal hook from their profile / recent post}}

Hi {{First name}},

{{ONE sentence about a specific thing they recently posted or said. NOT "I saw your work."}}

Quick context: {{MERCHANT}} {{one sentence on what we do in their audience's language}}.

We pay creators {{COMMISSION_%}}% of every $`{{ASP}}` conversion, weekly via Stripe. No minimums, no exclusivity, link tracking handled.

If interested, reply "send me a partner link" and I'll set it up the same day.

{{Sender first name}}
{{MERCHANT}} | {{MERCHANT}}.tld
```

The rules:
- **Personal hook in line 1.** Even at 50 sends, line 1 must be specifically about them. Use a feature-extraction script if you can't manually do 50 — pull from their last 3 posts.
- **Numbers up front.** `{{COMMISSION_%}}% × ${{ASP}} = ${{COMMISSION_$}}` per conversion. Make the math visible.
- **One-step yes.** "Reply 'send me a partner link'" — they don't have to go to a website, fill out a form, schedule a call.
- **Weekly payment is the trust signal.** Most affiliate programs pay net-60 / net-90. Weekly is unusual enough to stand out.

---

## List building

Source the 50 names from:
- Industry-specific YouTube channels with 1k–50k subscribers (above 50k = Tier-1; below 1k = not enough reach)
- Substack newsletters in the niche
- Twitter/X accounts with 1k–20k followers in the niche
- Niche course creators (Maven / Skillshare / Teachable instructors)
- Industry-specific subreddit power-users with > 5k karma in target subs

Don't:
- Buy a list — Tier-2 still needs to be ICP-aligned, bought lists are 80% miss
- Hit Linkedin's "people who follow X influencer" — those are aspirational fans, not creators with their own audience

Maintain the list at `docs/outreach/affiliate-tier2-list.md` with: Name, Handle, Niche, Why-They-Fit, Hook-from-Latest-Post.

---

## Send cadence

- **Days 1–5**: ~10 sends/day, manually personalized. Yes, this is 5 hours of operator time. The conversion rate makes it worth it.
- **Day 8**: Follow-up to non-responders. ONE follow-up only. After two ignored sends, drop the lead.
- **Day 12**: Audit. Which creators converted on intro? Which converted on follow-up? Which didn't reply? Use to refine the Tier-2 list for the next 50.

---

## Reply handling

Tier-2 replies go to `partners@{{MERCHANT}}.tld`, parsed by `inngest/functions/partner-reply-handler.ts` (see [PARTNERS.md](../../PARTNERS.md)) — **not** the regular customer reply-handler. The classification rules are different:
- "Yes" / "Send me the link" / "Interested" → create partner record + reply with onboarding link
- "Not for me" / "No thanks" / unsubscribe → mark declined, no follow-up
- "Tell me more" / "What's the catch" → flag for operator (questions need a human-quality answer)

---

## Tracking

| # | Name | Handle | Niche | Sent | Reply | Converted | $ Earned (Lifetime) | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
... |
| 50 | | | | | | | | |

**Quarterly review:**
- Top 5 converting creators: 2× them with deeper relationship (custom co-marketing, podcast appearance, etc.)
- Bottom 25 (no reply OR converted < 1 customer): drop from Tier-2 list permanently
- Net replace with new prospects sourced via the list-building criteria above
