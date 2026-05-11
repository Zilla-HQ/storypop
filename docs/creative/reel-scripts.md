# Reel scripts — vertical 9:16 UGC for Meta + IG

5 scripts to record on phone (no studio). Each is 15–25 seconds, vertical 1080×1920, optimized for Reels + TikTok-style placement on Meta. Per the existing `meta-ads-fatigue-check` cron these need to rotate every ~2 weeks.

**Setup before recording any of these:**
- Your phone, vertical
- Decent natural light (not direct sun, not lamp-lit)
- Clean audio — record in a quiet room or use lavalier; do NOT use TikTok's built-in mic if outdoor
- Use Restay-branded text overlay for the closer; CapCut or InShot is fine

---

## Reel 1 — "Paste your URL" demo (the workhorse)

**Length:** 18 seconds.

**Hook (0–1s):** Phone screen, slow zoom into restay.agency/grade in Safari/Chrome. No talking yet.

**Script (1–13s):** Voiceover (or text-to-speech) over screen recording.
> "Most Airbnb listings haven't been touched in over a year. I built a tool that scores any listing in 10 seconds. Free, no signup. You paste the URL —" *[show paste]* "— and you get a grade out of 100, broken down by photos, copy, and signals. Plus the three fixes that would lift bookings the most."

**Money shot (13–17s):** Screen-record a real grader output filling in. The "F" or "D" letter grade lands first, then the photo score, then the top 3 fixes appear one at a time.

**Closer (17–18s):** Static text overlay:
> "restay.agency/grade · free"

**Caption (Reel description, max 125 chars before "...more"):**
> Most Airbnb listings haven't been refreshed in over a year. Free 60-second grader: restay.agency

**CTA button:** "Learn More" → restay.agency/grade?utm_source=meta&utm_medium=paid_social&utm_campaign=audit_v1&utm_content=reel_paste_url_v1

---

## Reel 2 — "Before/after" photo flip

**Length:** 12 seconds.

**Hook (0–1s):** Big bold text on screen: "Same room. Same shot. Different photo edit."

**Script (1–10s):** A series of three before/after photo flips, each held for 3 seconds. Pull these from your existing `lib/samples.ts` outputs OR generate fresh ones via `scripts/generate-service-samples.mjs`.

Use a quick split-screen wipe transition between before and after.

Voiceover (optional, low-volume):
> "We don't add furniture. We don't change the layout. We re-light, re-color, and declutter — and listings convert better."

**Closer (10–12s):** Static text:
> "Edit-only photos · Airbnb policy compliant · restay.agency"

**Caption:**
> Phone-shot photos vs Restay-edited. Same room. Restay.agency

**CTA:** "Learn More" → restay.agency/?utm_source=meta&utm_medium=paid_social&utm_campaign=audit_v1&utm_content=reel_before_after_v2

---

## Reel 3 — "I haven't updated in 18 months" voiceover

**Length:** 22 seconds.

**Hook (0–2s):** Static text over a phone-shot slow pan of an Airbnb listing on the Airbnb app:
> "60% of Airbnb listings haven't been updated in over a year."

**Script (2–18s):** First-person voiceover, casual tone (your voice, no AI). Phone footage of you scrolling through your or a sample listing.

> "I used to think setting up my Airbnb was a one-time thing. Then bookings started dropping — same listing, same price, fewer guests. Turns out the market keeps raising the bar. New listings are coming in with magazine-grade photos and tighter copy, and mine had been the same for 18 months. The fix wasn't expensive — most of the work was just refreshing what I'd already shot. I built Restay so other hosts don't go that long without realizing it."

**Closer (18–22s):** Cut to restay.agency/grade in browser, with text overlay:
> "Grade your listing free · restay.agency"

**Caption:**
> Most hosts don't realize how far their listing has drifted. Free grader: restay.agency

**CTA:** "Learn More" → restay.agency/grade?utm_source=meta&utm_medium=paid_social&utm_campaign=audit_v1&utm_content=reel_18_months_v3

**Notes:** This is the highest-conversion variant in the playbook. UGC voiceover beats text-only by ~25–30% on cold reach. It needs to feel personal — re-record if it sounds like ad copy.

---

## Reel 4 — "Testimonial" slot (record AFTER first 5 paid customers)

**Length:** 15 seconds.

This one stays as a placeholder until you have 5 paid Tune-Ups. Then ask each customer:
> "Would you mind sending me a 30-second phone video saying how the Tune-Up went and what changed in your bookings? I'll send you another free Tune-Up in 6 months as a thank-you."

About 1 in 5 will say yes. Use the cleanest one.

**Format when you have it:**
- 0–1s: Customer's name + city as text overlay
- 1–12s: their phone-recorded testimonial
- 12–15s: cut to your before/after of their listing with "see their full Tune-Up at restay.agency"

**Caption:**
> Real Restay customer · [City]: "[their best line]"

**CTA:** "Learn More" → restay.agency/?utm_source=meta&utm_medium=paid_social&utm_campaign=audit_v1&utm_content=reel_testimonial_v1

---

## Reel 5 — "What guests see vs your competitors" split-screen

**Length:** 16 seconds.

**Hook (0–2s):** Bold text: "What your guests see when they're shopping."

**Script (2–14s):** Split-screen Airbnb search results. Left side = your sample listing's tile (the original photo, generic title). Right side = a competing listing's tile in the same city (better photo, sharper title).

Voiceover:
> "When a guest searches your city, this is what they see. The tile on the left is the average host's listing. The tile on the right is what's eating their bookings — same neighborhood, same price band, different photo and a tighter title. The fix is the same work. We do it for $79."

**Closer (14–16s):**
> "restay.agency · less than a month of Guesty"

**Caption:**
> Same city, same price band. Different listing tile. Restay.agency

**CTA:** "Learn More" → restay.agency/?utm_source=meta&utm_medium=paid_social&utm_campaign=audit_v1&utm_content=reel_split_screen_v5

---

# Production tips

1. **Shoot all 5 in one afternoon.** You're already set up; the marginal cost of recording the 4th and 5th is near-zero.
2. **One edit pass** — don't perfect them. Phone-shot UGC outperforms studio creative; over-polishing kills authenticity.
3. **Caption-burn the audio.** ~85% of Meta video plays on mute. Even with great voiceover, the on-screen text needs to carry the message.
4. **Save horizontal-aspect versions.** Same content, but 1080×1080, for Feed placements if you ever expand from Reels-only.
5. **Don't say "AI"** in any reel. Per your existing email-draft system prompt, Restay's editorial line is "audit pipeline" / "editor" — keep it consistent in paid creative.
6. **Refresh every 2 weeks.** Your `meta-ads-fatigue-check` cron flags freq > 2.5. Hold to it. Re-shoot Reel 1 first since it's the workhorse.

# Upload + ad-creation

Once recorded, the existing scripts handle the rest:

```bash
# Upload to FB Page (chunked, per docs/META_ADS_LAUNCH.md)
npx tsx --env-file=.env.local scripts/meta-upload-page-video.ts ./reel-1-paste-url.mp4

# Create the ad with that video_id
npx tsx --env-file=.env.local scripts/meta-create-ads.ts <video_id>
```

Edit `scripts/meta-create-ads.ts` `VARIANTS` constant to match the captions/headlines from this doc before running.
