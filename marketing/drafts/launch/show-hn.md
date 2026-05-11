# Show HN draft

**Submit at:** https://news.ycombinator.com/submit
**Recommend posting:** Tuesday or Wednesday, 8–9am Pacific (best HN traffic)

**Title:**
```
Show HN: Realscale – an autonomous AI photo SaaS for real estate (one human, six agents)
```

**URL:** `https://realscale.app/agents`

**Body (HN allows you to add a top comment after submitting — paste this as the first comment):**

```
Hey HN — solo dev here, sharing a real estate photo enhancement SaaS I've been building that's operated entirely by AI agents.

The product itself is conventional: paste a Zillow/Redfin/Realtor URL, get every listing photo virtually staged in under two hours, $89/listing, NAR-compliant disclosure stamped on every output. There are dozens of competitors in this space (BoxBrownie, VirtualStagingAI, Apply Design, etc.).

What's different is the operations stack. Six Inngest-orchestrated agents handle every order end-to-end:

  1. Discovery (cron) — pulls listings from Apify scrapers every 6h
  2. Qualification — scores photos + agent intent via Claude Haiku vision
  3. Preview — generates personalized before/afters via fal.ai Kontext
  4. Outreach — sends NAR-compliant cold email via Resend
  5. Reply Handler — classifies inbound and auto-replies via Claude
  6. Fulfillment — Sharp watermark, R2 zip, delivery email + Twilio SMS

I'm the only human. I don't touch individual orders. The system has been live and revenue-generating for a few months now.

Some things I learned that might be useful to others:

  • Compliance has to be hard guardrails outside the model, not prompts. CAN-SPAM footer, TCPA SMS gate, NAR watermark, state opt-outs — all enforced in code paths the model literally can't reach. The "agent decides whether to send" approach broke the moment a model hallucinated past a state opt-out.
  
  • Free preview before payment was the single biggest conversion lever. Generating a real before/after of the prospect's actual listing on first email click moved click→pay from ~2% to ~9%.

  • The unit economics work because fal.ai prices fell ~70% in 2024-2025. Per-listing fulfillment cost is now under $2 against an $89 ticket. Two years ago this would have been a money loser.

  • PostHog event-driven architecture makes the agents debuggable. Every step emits a typed event; I can replay any single listing's path through the system.

Stack: Next.js 15 / Postgres (Neon) / Drizzle / Inngest / fal.ai (Kontext) / Apify / Anthropic Claude (Haiku for cheap vision, Sonnet for replies) / Stripe / Resend / Twilio / Cloudflare R2.

There's also a homeowner side (realscale.app/renovate) — same backend, different vertical: free pool/solar/curb-appeal mockups rendered onto real Mapbox satellite tiles, monetized via contractor referral fees instead of per-photo charges. Useful test of the "merchant template" thesis: ~80% of the code is shared.

Ask me anything — code paths, model choices, what went wrong, the things I'd do differently.
```

---

**Notes for posting day:**
- Stay near the post for the first 60–90 minutes to respond fast — comment velocity is what gets you to the front page.
- Don't ask people to upvote; just answer questions thoroughly.
- If you reach 30+ points in the first hour you'll likely make front page.
- If someone asks about your stack, link to the playbook (`/MARKETING_PLAYBOOK.md`) and the social-poster code (`inngest/functions/social-poster.ts`) on github — devs love seeing real code.
