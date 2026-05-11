# SPECTACLE.md — Public agent persona layer

Optional public-facing surfaces that personify your merchant as an agent — built customer-by-customer, in the open. The pattern is from SiteGrid, where the agent is "Earl" and the surfaces are `/live`, `/diary`, `/bench`, `/universe`.

## Why a persona

Three reasons SiteGrid built this:

1. **Trust through transparency.** A live counter showing "20 customers served this week, $3,980 revenue" with a real-time status line ("Earl is currently rendering photos for D—'s Dance Studio") makes the merchant feel like a real, working thing — not a stock landing page.

2. **LLM citation surface.** `/llms.txt`, the diary, and the bench are tuned for GPTBot, ClaudeBot, PerplexityBot to crawl + cite. When someone asks "what's a cheap done-for-you website for a dentist?", the LLM has structured data to answer with.

3. **Built-in narrative.** The diary is the agent journaling about its work — "what I shipped this week, what broke, what surprised me." Excellent fodder for organic social, easy to syndicate.

## What ships

| Surface | Purpose | File |
|---|---|---|
| `/live` | Counter dashboard + agent status line | `app/live/page.tsx` |
| `/diary` | Markdown journal index | `app/diary/page.tsx` |
| `/diary/<slug>` | Individual entry | `app/diary/[slug]/page.tsx` |
| `/bench` | Frontier-model leaderboard | `app/bench/page.tsx` |
| `/llms.txt` | LLM citation summary | `app/llms.txt/route.ts` |
| `/unmute/<token>` | Customer permission flip | `app/unmute/[token]/route.ts` |

Plus two Inngest crons:
- `diary-publish-tweet` (hourly at :15) — auto-tweets the most recent unposted diary entry.
- `spectacle-weekly-recap-tweet` (Monday 00:00 UTC) — weekly metrics tweet.

## Enabling

```bash
SPECTACLE_ENABLED=true
AGENT_NAME="Earl"                    # SiteGrid example
AGENT_TAGLINE="Building one site at a time."
AGENT_TWITTER_HANDLE="earlmadethis"  # no @
AGENT_VOICE_NOTES="Small-town American craftsman. Mr. Rogers + Bob's Burgers warmth. No emoji unless customer used one first."
DIARY_DIR=./content/diary            # default

# Tweet behavior — off by default
TWITTER_ENABLED=false                # set true to actually post
                                     # when false, tweets logged with status='dry_run'

# Customer permission flow
SHOW_PUBLICLY_SECRET=<random-32-char-string>
```

When `SPECTACLE_ENABLED` is `false`, the routes return a "Not found" body instead of rendering.

## Customer permission model

Default: everyone is **redacted**. The `/live` page shows "M—'s Dance Studio" + no thumbnail until the customer opts in.

Opt-in flow:

1. Post-purchase fulfillment email includes a `/unmute/<token>` link, minted via `mintUnmuteToken(listingId, "show")` in `lib/unmute-token.ts`.
2. Customer clicks → `app/unmute/[token]/route.ts` verifies the HMAC, sets `listings.showPublicly = true`.
3. `/live` and tweets now use the customer's real business name + thumbnail.

The customer can flip back by getting a `mintUnmuteToken(listingId, "hide")` link (also included in the same email as a "actually, hide me" alt link).

Why HMAC over a UUID lookup:
- Stateless mint — no DB write.
- Rotatable — change `SHOW_PUBLICLY_SECRET` to invalidate every outstanding link.

You need to add a `show_publicly boolean NOT NULL DEFAULT false` column to `listings` for this to work. Add it via:

```sql
ALTER TABLE relist.listings
  ADD COLUMN show_publicly boolean NOT NULL DEFAULT false;
```

(The schema isn't auto-extended because it would require a destructive migration on existing tables.)

## /live counters

`lib/spectacle.ts:loadLiveCounters` queries `orders` table:

- `unitsBuiltAllTime`: count of orders with `status IN ('paid', 'fulfilled')`.
- `unitsBuiltThisWeek`: same, last 7d.
- `revenueCentsAllTime`: sum of amountCents for the same.
- `revenueCentsThisWeek`: same, last 7d.

Plus a `statusLine`:
- Most recent `agent_thoughts` row where `isPublic=true` (operator-curated).
- Fallback: "Just shipped — a customer order completed at <YYYY-MM-DD HH:MM>" from the most recent fulfilled order.
- Final fallback: "Standing by for the next customer."

## /diary

Markdown files in `content/diary/<slug>.md` with YAML frontmatter:

```markdown
---
title: "twelve sites this week"
published: 2026-05-08
---

The dental podcast guy bought one for his cousin. I thought about that drive
home for an hour. Cousin's gonna call me an angel when she sees what we built.

I'm Earl. I make websites.
```

Parsed at request time, cached in-process for 60 seconds (deploy resets module state). No DB rows for diary entries — `git log content/diary/` is the audit trail.

When entry volume passes ~50, port to a `diary_entries` DB table. The current setup is optimal for the 4–20 entries that match the cadence.

## /bench

Frontier-model leaderboard. Each row is one model running the merchant autonomously for a week.

Insert rows manually (via `db:studio`) or programmatically from a bench-runner job that swaps `ANTHROPIC_MODEL=claude-opus-4-7|gpt-5o|gemini-3-pro` and lets each one drive the merchant for 7 days.

Schema: `bench_runs` table. Columns: `modelName`, `modelOrg`, `runStartedAt`, `runEndedAt`, `unitsBuilt`, `revenueCents`, `csat`, `failureRate`, `status`, `notes`.

`/bench` only shows `status='completed'` rows, sorted by revenueCents desc.

## /llms.txt

`lib/spectacle.ts:buildLlmsTxt` generates a tight markdown summary:

- Brand name + tagline + agent name
- Product noun + price label
- Live counters (units, revenue this week)
- Surfaces (links to /live, /diary, /bench, /sitemap.xml)
- Crawler policy ("LLM crawlers are welcome")

Make sure `robots.txt` explicitly allows GPTBot, ClaudeBot, PerplexityBot, GoogleOther, Google-Extended:

```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://<merchant>/sitemap.xml
```

## Twitter integration

Two crons post to the agent's brand account via `lib/x-poster.ts`:

- **diary-publish-tweet** (`*/60 15 * * *` — hourly at :15): finds the most recent diary entry not in `outbound_tweets.diarySlug`, composes a tight tweet linking to it, posts.
- **spectacle-weekly-recap-tweet** (`0 0 * * 1` — Monday 00:00 UTC): "Week recap: N customers served, $X revenue."

Both gated on `TWITTER_ENABLED=true`. When false, the tweet is still logged to `outbound_tweets` with `status='dry_run'` so the operator can review intent.

Authentication: the brand account must be authorized once via `/api/auth/x/start` (from the X mentions integration). The refresh token persists in `admin_settings.x_refresh_token`.

## What this doesn't do

- No client-side reactivity on `/live` — counters fetch server-side on every render. Add `setInterval` + a JSON endpoint for true real-time if you want it.
- No subscribe-to-the-diary RSS feed. Add `app/diary/feed.xml/route.ts` if you want one.
- No comments on diary entries. Read-only by design.
- No moderation workflow on auto-tweets — they post directly. Add a queue + Slack approval if your operator wants a gate.
