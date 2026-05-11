# Ad creative generator — `/og-ad`

The merchant template ships a second OG-image route specifically for **paid ad creatives** (distinct from `/api/og`, which is for organic share cards).

`app/og-ad/route.tsx` — Edge route that emits PNGs at request time. Right-click → Save image, upload to Meta Ads Manager / Reddit Ads / TikTok Ads. No design tool, no Figma round-trips, no broken color profiles.

Pattern proven on the reference [Sitebeat](https://github.com/Zilla-HQ/sitebeat) merchant.

---

## Why a second OG route

`/api/og` exists already for organic Open Graph share cards (1200×630, landscape — what Twitter/LinkedIn/Slack render when someone shares a merchant URL). It's optimized for "preview when shared," not "stop the scroll."

Paid ad creatives have different constraints:

| Constraint | `/api/og` | `/og-ad` |
|---|---|---|
| **Aspect ratio** | 1.91:1 (1200×630) | 1:1 (1080×1080 Feed) + 9:16 (1080×1920 Stories/Reels) |
| **Use** | Embedded in HTML meta tags; auto-rendered when shared | Manually right-clicked, uploaded to Ads Manager |
| **Trigger** | Bot crawlers (Twitter card scraper, Facebook OG fetcher) | Operator's browser, once per ad |
| **Variants** | 1 per page, dynamic per URL | Multiple campaign-angle variants per page |
| **Persistence** | Cached by every social platform once fetched | Operator downloads and uploads to the ad network |

So you can't reuse `/api/og` for ads — the aspect ratio is wrong for Reels/Stories, and you want a small library of angle variants, not a per-URL render.

---

## Usage

```
GET /og-ad?v=<variant>&format=<square|vertical>
```

Query params:

- **`v=<variant>`** — which creative angle. Sitebeat ships `hook` (default), `fix`, and `weekly`. Edit the `variants` object in the route to add merchant-specific angles.
- **`format=<square|vertical>`** — `square` (1080×1080, default — Feed placements on Meta + Reddit) or `vertical` (1080×1920 — Stories, Reels, 9:16).

Example URLs:

```
https://<your-merchant>/og-ad?v=hook&format=square     → Feed creative, hook angle
https://<your-merchant>/og-ad?v=hook&format=vertical   → Stories/Reels, hook angle
https://<your-merchant>/og-ad?v=fix&format=square      → Feed creative, fix angle
```

Open in a browser, right-click → Save Image. The render is server-side via Next.js `ImageResponse` (Edge runtime), no client-side processing.

---

## Creative angles (per merchant)

The Sitebeat default ships three:

- **hook**: "What grade is your SEO?" with a red **F**. Highest CTR for cold audiences — curiosity.
- **fix**: "Find what's broken. Get the exact fix." with an amber **C**. Higher intent — appeals to people who already think they have a problem.
- **weekly**: "If your SEO regressed yesterday, would you know?" with a green **B**. Re-targeting / warm — sells the monitoring side, not the audit.

For your merchant, replace the `variants` object in `app/og-ad/route.tsx`:

```ts
const variants: Record<string, { eyebrow: string; headline: string; sub: string; accent: string; accentColor: string }> = {
  hook: {
    eyebrow: "<MERCHANT> · CATEGORY",
    headline: "<curiosity-driven question>",
    sub: "<one specific value prop>",
    accent: "<single emphasis word or grade>",
    accentColor: "#ef4444",
  },
  fix: { /* problem-aware angle */ },
  weekly: { /* retention/monitoring angle, for retargeting */ },
};
```

Test 3 angles minimum. Meta's algorithm needs creative variety to find the right ICP-to-angle pairing — single-creative campaigns plateau within 5 days.

---

## Recommended starter angles (any merchant)

These four angles cover the bulk of paid-ad copy that works for autonomous SaaS:

1. **Curiosity** — "What's your <metric>?" The merchant's hook as a question. Lowest cold-ask friction; gets the highest CTR but lower close rate.
2. **Pain** — "Your <thing> is <broken / invisible / leaking>. Find out where." Speaks to people who already feel the problem. Higher CTR-to-conversion ratio.
3. **Authority** — "We just <audited / generated / scanned> 100 <vertical>. Here are the 5 things they all get wrong." Works once you have artifact volume.
4. **FOMO** — "Your competitors are <doing the better thing>. You're not. <Free CTA>." Retargeting only — too aggressive cold.

Sitebeat's `hook` maps to (1), `fix` to (2), `weekly` to (3) reframed as "your past self vs. your future self."

---

## Workflow

For each campaign launch:

1. Visit `/og-ad?v=<variant>&format=square` and `/og-ad?v=<variant>&format=vertical` in your browser.
2. Right-click → Save Image. Name files `<merchant>-<variant>-<format>.png` so you can track which converted.
3. In Meta Ads Manager / Reddit Ads / TikTok: upload the square creative to Feed placements, the vertical to Stories/Reels placements.
4. After 50+ impressions per creative, the ad network's CTR data tells you which angle works for which ICP.
5. **Kill the bottom 50% by CTR** at the 2-week mark; iterate on the top variants.

---

## Why server-rendered (Edge) PNGs vs. Figma exports

- **Iteration speed**: editing the headline takes one prop change + one save, not a Figma round-trip.
- **No designer dependency**: solo operator can ship a new angle in 5 minutes.
- **Consistency**: every creative inherits the same brand colors / font / layout from a single source. No drift.
- **Versioning**: the creatives live in git. You can A/B-test against an older version by reverting the variant prop.
- **No font / color-profile breakage**: PNG out of Next.js `ImageResponse` is sRGB-clean; no Adobe RGB → sRGB conversion issues.

---

## Limitations

- **No real photography.** `ImageResponse` renders text + flat color + simple SVG well; it doesn't compose product photos. For merchants whose hook is "before/after image," ship a separate JPG library and reference it from the `ImageResponse` markup via `<img src=...>` (Edge fetch).
- **No animation.** Static PNG only. For video creatives, use a separate tool (Sitebeat uses 5-second screen-recordings of the audit form filling itself in).
- **Edge runtime constraints**: no Node APIs, no `Buffer`, no `fs`. If you need to compose external images, fetch them inline.

---

## Reference implementation

See Sitebeat's `app/og-ad/route.tsx` for a working 3-variant × 2-format Edge route under 100 lines. Pattern transplants directly — replace the `variants` object, redeploy.
