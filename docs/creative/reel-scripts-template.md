# UGC vertical reel scripts — `{{MERCHANT}}`

5 vertical UGC reel scripts (15–25s, 1080×1920, shot on iPhone) for Meta + Instagram. Rotate every ~2 weeks to fight ad fatigue (see [META_ADS.md §fatigue-check](../../META_ADS.md)).

**The operator records these themselves.** Not an actor, not a freelancer (except for Reel 5 below if budget allows). Authenticity is the conversion driver — polished agency reels score lower than handheld phone footage in this vertical's testing.

> **Reference:** Restay's filled-in version lives at [`Zilla-HQ/airbnb/docs/creative/reel-scripts.md`](https://github.com/Zilla-HQ/airbnb/blob/main/docs/creative/reel-scripts.md).

---

## Reel 1 — "The Audit Hook" (15s)

**Goal:** drive grader runs (Meta `Lead` conversion). Workhorse of the rotation.

**Hook (0–3s):** Direct-to-camera, dead-stop.
> "Your `{{vertical artifact — Airbnb listing, website, restaurant menu}}` is probably bad. Here's how to find out for free."

**Action (3–10s):** Screen recording of the operator pasting their own URL into `/grade`, hitting submit, the grader running.
- On-screen text overlay: "0 → 100 in 60 seconds"

**Reveal (10–13s):** The score appears.
- On-screen text: "{{score}} — here's the 3 fixes"

**CTA (13–15s):** Direct-to-camera, smiling.
> "Go to {{MERCHANT}}.tld/grade. Free, no signup."

**Captions:** Always have captions burned in. ~70% of Meta video watches are muted.

---

## Reel 2 — "The Before/After Reveal" (20s)

**Goal:** drive Purchase (`InitiateCheckout` → `Purchase`). Use after Reel 1 has warmed the audience.

**Hook (0–3s):** Hold up phone with a recipient's `{{poor-quality artifact — bad listing photo, bad website screenshot}}`.
> "This `{{artifact}}` is losing them `{{LOSS_$}}` a month."

**Pain (3–8s):** Specific reasons it's bad. Quick cuts:
- "Photos shot at 4pm with bad lighting"
- "Title doesn't say `{{specific keyword that matters in vertical}}`"
- "Pricing is `{{$}}` under market"

**Solution (8–16s):** Cut to the `{{MERCHANT}}` deliverable. Same artifact, fixed.
- On-screen text: "`{{MERCHANT}}` does this in `{{TURNAROUND_HOURS}} hours`."

**CTA (16–20s):** Direct-to-camera.
> "`${{ASP}}` one-time. Link in bio. Or {{MERCHANT}}.tld."

---

## Reel 3 — "The Hot Take" (20s)

**Goal:** organic share + comment engagement. Doesn't need to convert directly — feeds top-of-funnel awareness.

**Hook (0–3s):** Direct-to-camera, deadpan.
> "`{{HOT TAKE — controversial-but-true statement about your vertical}}`."

**Examples for Restay:**
- "Most Airbnb hosts are leaving $200/night on the table because they price like it's 2019."
- "Your listing's #1 photo doesn't need to be the living room. Hosts are wrong about this."

**Argument (3–17s):** 14 seconds of supporting evidence. Three points, fast cuts:
- Point 1 with on-screen text
- Point 2 with on-screen text
- Point 3 with on-screen text

**Land (17–20s):**
> "I built `{{MERCHANT}}` to fix exactly this. {{MERCHANT}}.tld."

**Why this works:** Controversial-but-true takes get shared and commented on. The comments themselves are the conversion engine — every reply is a free impression to that commenter's network.

---

## Reel 4 — "The Customer Reaction" (25s)

**Goal:** social proof. Sequence after Reel 1 + Reel 2 in the same ad set.

**Setup (0–3s):**
> "A customer messaged me yesterday."

**Screenshot reveal (3–10s):** Slow scroll over a real (anonymized) inbound message from a customer. The screenshot needs to feel genuine — don't fake this.
- On-screen text reading the message word-for-word with the customer's name blurred

**Context (10–18s):** Direct-to-camera.
> "She paid `${{ASP}}` and got `{{result}}` two days later. `{{specific concrete outcome — booked X nights, made Y, ranked higher on Z}}`."

**CTA (18–25s):**
> "If your `{{vertical artifact}}` isn't performing, try us. Risk-free — if you don't see results, refund."

---

## Reel 5 — "The Meme / Trend" (15s) — optional, hire if needed

**Goal:** algorithm-favor + Gen-Z + Millennial-leaning reach. The least-evergreen of the 5 — refresh every 2–3 weeks because trends decay.

**Format:** Whatever trending sound / meme / format is in your vertical's TikTok/IG audit this week. Examples:
- "POV: you're the host who finally optimized their listing"
- A trending meme audio with your category-specific punchline
- A duet / response to a popular creator's recent reel

**Why this is a "hire if budget":** Trend literacy is a skill. If the operator isn't already on TikTok daily, hire a UGC creator from Insense or Backstage ($300–800/reel). If the operator IS on TikTok daily, this is free.

---

## Production rules (all reels)

- **Shot on phone in vertical (1080×1920).** No DSLR, no agency-style cinematic. Phone footage outperforms in this category by ~30%.
- **Captions burned in.** ~70% of Meta video views are muted.
- **First 3 seconds = the hook.** Meta's algorithm decides whether to keep showing the reel based on the 3-second view-rate. Lead with the most attention-grabbing frame.
- **Direct-to-camera, no scripts read off paper.** Memorize bullet points, riff. Polished feels like an ad; unpolished feels like content.
- **Branded outro for ≤ 2 seconds.** Just the logo + the URL. Long branded outros hurt watch-completion.

---

## Rotation cadence

- Week 1–2: Reel 1 (Audit Hook) — workhorse
- Week 3–4: Reel 2 (Before/After) — conversion
- Week 5–6: Re-shoot Reel 1 with a new variation (different angle, different camera height, different opening line) — the original is fatiguing
- Week 7–8: Reel 3 (Hot Take) — organic + share
- Week 9–10: Reel 4 (Customer Reaction) — social proof
- Week 11–12: Reel 5 (Meme/Trend) — algorithm boost
- Week 13+: Re-shoot Reel 1 again, restart cycle with new sub-variants

Run `inngest/functions/meta-ads-fatigue-check.ts` (already in template) to get alerted when frequency > 2.5 on any creative — that's the signal to rotate.

---

## What to record in one shooting session

In one afternoon, record:
- Reel 1, three variations (different opening lines)
- Reel 2 with the operator's own `{{artifact}}` as the before/after
- Reel 3 with the operator's strongest hot take
- B-roll: 30 seconds of you working at your laptop, walking with your phone, generic ambient shots (use as cut-aways in any reel)

That's enough material for ~2 months of rotation.
