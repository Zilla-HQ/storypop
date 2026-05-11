# Inman pitch

**Send to:** tips@inman.com (general tips), or directly to one of:
- Andrea V. Brambila — andrea@inman.com (proptech beat)
- Craig Rowe — craig@inman.com (tech reviews)
- Marian McPherson — marian@inman.com (agent technology)

**Subject:** A solo agent runs an autonomous AI photography business — full agent stack, real numbers

**Body:**

Hi {first name},

I run Realscale, a real estate photo enhancement service that's fully agent-operated end-to-end. One human (me, in California) wrote the system; six AI agents handle every order: discovery from MLS, qualification, photo generation, cold outreach, fulfillment with NAR-compliant disclosure, and reply triage.

I think there's a story here for the Inman audience — not "AI is coming for your job," but a concrete look at what an autonomous SaaS in real estate actually looks like in 2026 when one person is willing to wire it up.

What I can share if you're interested:

- **The agent architecture.** Six Inngest-orchestrated functions, each with a single responsibility. I'll walk through the discovery → qualification → preview → email → fulfillment handoff with code-level detail.
- **Cold outreach numbers, raw.** Sends, opens, clicks, replies, conversions, complaint rate, deliverability score over the last 90 days.
- **Unit economics.** Per-listing fulfillment cost (fal.ai + R2 + Resend), CAC by channel, gross margin at our $89/$149/$199 tiers.
- **What still breaks.** Where agents make wrong calls, where I had to add hard guardrails (CAN-SPAM footer, NAR watermark, TCPA SMS gate, state opt-out checks — all hardcoded, no model bypass), where compliance forced me to re-architect.
- **The merchant-template thesis.** This is built to fork: same backend, different vertical. I think most B2B SMB SaaS gets rebuilt this way over the next 24 months.

I'm not running a PR cycle, I just think this might be a useful vignette for your readers. Happy to walk through it on a 30-minute call any day next week, or just answer questions over email.

— Jack
jack@seifdn.org
realscale.app
