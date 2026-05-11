# `{{MERCHANT}}` operator playbook (MANUAL_CHECKLIST)

This is the canonical list of things **only the operator** can do for `{{MERCHANT}}`. Everything else (discovery → preview → outreach → reply triage → fulfillment) is handled by Inngest agents.

Copy this file to `docs/MANUAL_CHECKLIST.md` in your merchant fork and replace `{{MERCHANT}}`, `{{ICP_SUBREDDITS}}`, `{{PERSONAL_TOUCH_LIST}}` placeholders. Refresh the checklist quarterly.

> **Reference:** Restay's filled-in version lives at [`Zilla-HQ/airbnb/docs/MANUAL_CHECKLIST.md`](https://github.com/Zilla-HQ/airbnb/blob/main/docs/MANUAL_CHECKLIST.md). Copy the structure.

---

## Day-0 launch (one-time, ~1 day total)

### Domain + email setup
- [ ] Register `{{MERCHANT}}.tld` and one defensive backup (e.g. `.app` / `.co`)
- [ ] Add domain to Vercel project (auto-DNS will offer Resend DKIM/SPF for the `mail.` subdomain)
- [ ] Verify Resend domain (`mail.{{MERCHANT}}.tld`) — wait for DKIM + SPF + DMARC green checks
- [ ] Create the `replies@{{MERCHANT}}.tld` inbound address; verify the Resend webhook destination
- [ ] **Begin the 14-day domain warm-up ramp** — see [RESTAY.md §Domain warm-up](../RESTAY.md#domain-warm-up-ramp). Daily caps: 25 → 50 → 100 → 200 → 500 → 1000.

### Accounts (all under Zilla HQ org, not personal)
- [ ] Vercel project (Zilla HQ team)
- [ ] Supabase project (us-east-2 pooler, port 6543 / Supavisor transaction pooler)
- [ ] Stripe account (live mode, tax enabled, webhook → `/api/stripe/webhook`)
- [ ] Resend (verified `mail.{{MERCHANT}}.tld`)
- [ ] Cloudflare R2 bucket `{{MERCHANT}}-photos` (or `{{MERCHANT}}-assets`)
- [ ] Inngest Cloud app, sync `/api/inngest` endpoint
- [ ] Clerk app (admin-only allowlist, no public signups)
- [ ] PostHog project
- [ ] Apify account, fund actor runs
- [ ] Hunter.io (free tier 25/mo to start, upgrade once enrichment volume justifies)

### One-time content / creative
- [ ] Write the `/manifesto` page (founder essay; 600–1000 words on *why* `{{MERCHANT}}` exists). See [RESTAY.md §Founder essay](../RESTAY.md#founder-essay--manifesto-page).
- [ ] Record 5 vertical UGC reels (15–25s, 1080×1920) — drafts in [`docs/creative/reel-scripts-template.md`](./creative/reel-scripts-template.md).
- [ ] Build the per-vertical pricing comparison chart (your offer vs. each subscription incumbent's annual cost) for the landing page.

---

## Week-1 manual operator work

### Branded Google Ads ($50/mo, set-and-forget — ~1h setup)
- [ ] Follow [`GOOGLE_ADS_OPERATOR.md`](../GOOGLE_ADS_OPERATOR.md) for the manual UI walkthrough (until Basic Access is approved + the programmatic launch script unblocks)
- [ ] Bid only on brand terms: `{{MERCHANT}}`, `{{MERCHANT}}.tld`, common misspellings
- [ ] Conversion action: URL contains `/delivery/`
- [ ] Daily budget: $2 to start; cap at $10/day

### Affiliate outreach — Tier 1 (~1h)
- [ ] Identify the 10 highest-leverage industry voices in your space (podcasters, course creators, OG bloggers, the operator's existing network)
- [ ] Open [`docs/outreach/affiliate-tier1-template.md`](./outreach/affiliate-tier1-template.md) and personalize each draft per recipient
- [ ] Send from the operator's personal address (not `partners@{{MERCHANT}}.tld` — Tier-1 must look 1:1)
- [ ] Goal: 3+ replies of 10. Lower than that = sharpen the pitch.

### Podcast sponsor inquiries — Tier 1 (~30min)
- [ ] Pick 3 podcasts that fit the ICP and don't already have a dominant sponsor in your category
- [ ] Open [`docs/outreach/podcast-sponsors-template.md`](./outreach/podcast-sponsors-template.md) and personalize
- [ ] Send from operator's personal address

### Reddit organic (30 min/day, ongoing)
- [ ] Active subreddits to follow: {{ICP_SUBREDDITS}}
- [ ] Posting cadence: 0 posts the first 2 weeks. Comment helpfully on others' threads, build handle reputation.
- [ ] Starting week 3+: one helpful post per week max. Never promotional until the handle has 1000+ karma in the relevant subs.
- [ ] If someone asks "what tool" in a thread you've engaged with, you can mention `{{MERCHANT}}` *once* per thread, with full disclosure.

---

## Week 2–4 manual operator work

### YouTube preroll on hand-picked channels (~30min setup, manual placement targeting)
- [ ] Identify 3–5 YouTube channels that match the ICP exactly (not category-level — specific channel IDs)
- [ ] Google Ads → Video → Placements → channel UC* IDs
- [ ] Daily budget: $20 × 7 days = $140 test
- [ ] Conversion action: same as branded
- [ ] Pause after 7 days if CAC > 2× target

### Affiliate outreach — Tier 2 (~2h)
- [ ] 50 mid-tier coaches / creators in your space
- [ ] Open [`docs/outreach/affiliate-tier2-template.md`](./outreach/affiliate-tier2-template.md) — bulk-but-personal template
- [ ] Send via `partners@{{MERCHANT}}.tld` (see [PARTNERS.md](../PARTNERS.md))
- [ ] Goal: 5+ replies of 50

### Personal outreach (operator's existing network)
- [ ] Send `{{MERCHANT}}` launch announcement to {{PERSONAL_TOUCH_LIST}} — friends, prior coworkers, founders in adjacent spaces
- [ ] Personal tone, no template — these are the warmest leads in the entire funnel and convert at 20×+ cold rates

---

## Ongoing weekly cadence (15 min/day average)

- [ ] **Mon**: Review last week's KPIs (orders paid, outreach reply rate, grader runs, Meta CAC). Update `docs/growth-plan.md` 30/60/90 checkboxes.
- [ ] **Mon**: Check Resend domain reputation (bounce rate, complaint rate); halt sends if either tripped a threshold.
- [ ] **Tue–Thu**: Respond to inbound reply-handler escalations flagged as "complex" — these are the 10% of replies the auto-classifier couldn't handle.
- [ ] **Fri**: Reply to any unanswered Tier-1 affiliate emails; nudge slow conversions.
- [ ] **Daily** (any time): Check `/admin` readiness dashboard; address anything red.

---

## Quarterly cadence

- [ ] Re-shoot the workhorse UGC reel (the one Meta picked up most) to fight ad fatigue
- [ ] Refresh `docs/growth-plan.md` — re-do the competitor sweep, update the 30/60/90 sequencing
- [ ] Audit the enrichment pipeline match rates (where are the misses concentrated? add a new registry / signal?)
- [ ] Review affiliate / partner payouts — pause the ones that didn't pay back; double down on the ones that did

---

## Don't do these (operator anti-patterns)

- ❌ **Don't lift the daily-send-cap in the first 14 days** — domain reputation is the single biggest deliverability lever, no shortcut compensates.
- ❌ **Don't run cold ads before the funnel converts a single warm lead** — paid burns through cash 100× faster than organic. Get conversion proof first.
- ❌ **Don't write public posts about `{{MERCHANT}}` on Reddit before the handle has earned trust** — instant ban + permanent reputation damage in the most valuable subreddit.
- ❌ **Don't add SMS / Twilio in v1** — A2P 10DLC registration takes 4+ weeks; email + on-platform messaging is enough until you have 100+ paid customers.
- ❌ **Don't manually email recipients who haven't been through the enrichment pipeline** — you'll skip the state-optout gate (`lib/state-optout.ts`) and expose the merchant to a CCPA complaint.
