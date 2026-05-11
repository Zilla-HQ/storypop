# SEO — full runbook

> **One-liner:** every Zilla merchant auto-registers itself with Google Search Console, Bing Webmaster, and IndexNow on every deploy — no per-merchant operator action. Sitemap submitted, ownership verified, every URL pinged for real-time indexation.

> Distilled from setting up a real merchant (Sitebeat) end-to-end. Every gotcha here cost real time to discover; following this top-to-bottom should let an engineer ship and an operator verify in **~30 minutes**.

This is the canonical SEO setup for any Zilla merchant. The template ships with the code in place; this doc is **what each role does to wire it up against Google, Bing, and IndexNow** — including how it works when the merchant lives at `xyz.zilla.so` rather than its own apex domain.

Two readers:

- **Engineers** (Zilla platform team or merchant fork team): §1, §3, §6, §8 — the code paths, env vars, and platform-level decisions
- **Operators** (the human running the merchant): §2, §4, §5, §7 — the click-through runbook in Search Console, Bing Webmaster, etc.

---

## 0. When NOT to spend time on this

If the merchant has **no public marketing surface** (e.g. it's a B2B portal that only paying customers reach), skip everything below. SEO matters only when there are pages you want strangers to find via search.

If the merchant has a marketing surface but **no programmatic SEO content yet** (no `/tools/*`, `/vs/*`, `/blog/*`, etc.) — ship sitemap + robots + verification anyway. Indexation lag is real (Google takes 1–4 weeks to crawl new pages) and submitting an empty-ish sitemap costs nothing while content is being written.

---

## 1. Architecture decision: subdomain vs. apex domain

A Zilla merchant lives at one of two URLs:

1. **Apex domain** — the merchant owns its own (e.g. `sitebeat.tech`, `realscale.app`).
2. **Subdomain of `zilla.so`** — operator-of-record path (e.g. `xyz.zilla.so`).

The SEO setup is **mostly identical** between the two, with three differences in the verification step. This section is the single place where the architecture matters; everywhere else in this doc, treat the merchant URL as a black box.

### Key sub-domain facts

- A Domain-property verification at `zilla.so` automatically covers **all** subdomains. You can verify `zilla.so` once via DNS TXT and inherit verification for `xyz.zilla.so`, `abc.zilla.so`, and any future merchants.
- A URL-prefix verification at `https://xyz.zilla.so` requires its **own** verification step (HTML meta tag or HTML file at `/`). DNS-based methods at the subdomain level don't apply because Vercel doesn't expose subdomain-only DNS to you.
- IndexNow keys are scoped to a **specific host**. Each subdomain needs its own key file at `https://xyz.zilla.so/<key>.txt` and its own ping submissions.

### The recommended approach (Zilla operator-of-record subdomains)

| Action | Where | Who | Frequency |
| --- | --- | --- | --- |
| **DNS TXT verification at `zilla.so`** | Vercel DNS for the apex zone | Zilla platform team | One-time, covers all `*.zilla.so` |
| **Add merchant subdomain as URL-prefix property** | GSC + Bing | Operator | Per merchant, at launch |
| **Submit per-merchant sitemap** | GSC + Bing | Operator | Per merchant, at launch + on major content drops |
| **Generate per-merchant IndexNow key** | `scripts/generate-indexnow-key.mjs` | Engineer | Per merchant fork |
| **IndexNow ping** | `scripts/indexnow-ping.mjs` | Engineer / cron | After every deploy with new pages |

The apex `zilla.so` Domain property gives you a global view of all merchants — useful for the platform team. The per-merchant URL-prefix properties give each operator their own filtered view of just their subdomain's data, and let you grant them GSC/Bing access without exposing the rest of the portfolio.

### The recommended approach (apex-domain merchants like Sitebeat)

Identical to subdomain, except the operator can choose **DNS TXT verification at the merchant's apex** if they own the domain at Vercel. That's a one-time verification that covers `https://`, `http://`, `www.`, and any future subdomains the merchant might add (`app.`, `mail.`, etc.). Cleaner than per-prefix verification.

---

## 2. Operator runbook (~15 minutes per merchant)

> Run this **after** the engineer has shipped the code in §3 and the merchant is live at its public URL. Order matters — Google verification first because it's the slowest to propagate.

### 2.1 Google Search Console (5 min + ~1hr DNS propagation if using TXT)

1. Open [search.google.com/search-console](https://search.google.com/search-console).
2. Click **Add property**.
3. Choose **URL prefix** (not Domain) and enter the merchant URL — `https://xyz.zilla.so` or `https://merchant.tld`. Confirm trailing slash matches what the merchant actually serves.
4. Pick verification method **HTML tag**.
5. Copy the `<meta name="google-site-verification" content="...">` tag.
6. **Send the verification token to the engineer** to ship via env var — do **not** paste it directly into the codebase. The engineer sets `NEXT_PUBLIC_GOOGLE_VERIFICATION` in Vercel and redeploys. The tag lands in `<head>` automatically via `metadata.verification.google` in `app/layout.tsx`.
7. Wait for the deploy to land, then click **Verify** in GSC. Should succeed within seconds.
8. Once verified, click **Sitemaps** in the left sidebar. Enter `sitemap.xml`. Click **Submit**.
9. Within ~24 hours you'll see "Success" status with the URL count discovered. Within 1–4 weeks, pages start appearing in the **Pages** report as Indexed.

#### Subdomain-only gotcha

If the merchant lives at `xyz.zilla.so` and the platform team has already done a Domain-property verification on `zilla.so`, **GSC will pre-populate the verification status for the subdomain**. You still need to add the URL-prefix property explicitly to get sitemap submission + per-merchant Performance reports.

#### Submitting the sitemap

For URL-prefix properties, enter `sitemap.xml` (relative path).
For Domain properties, enter the full URL `https://xyz.zilla.so/sitemap.xml`.
Wrong format = "Invalid sitemap address" error. The error message doesn't tell you which form it expected — try the other one.

### 2.2 Bing Webmaster Tools (5 min)

Bing indexes faster than Google (typically hours not weeks) and IndexNow gives you near-realtime indexation, so this step has higher leverage than people assume.

1. Open [bing.com/webmasters](https://www.bing.com/webmasters).
2. **Add a site** → enter the merchant URL.
3. Pick verification method **XML File**. Bing shows you a verification token (e.g. `40759474A5E4B7C69E2658CAE1EBFD32`).
4. **Send the verification token to the engineer.** They run `BING_TOKEN=<token> node scripts/generate-bing-auth-file.mjs`, which writes `public/BingSiteAuth.xml` with the right content. Engineer commits + deploys.
5. Wait for deploy, click **Verify** in Bing Webmaster. Succeeds within seconds.
6. Once verified, **Sitemaps** → **Submit sitemap** → enter `https://xyz.zilla.so/sitemap.xml` (full URL).
7. **Configure my site** → **IndexNow** → confirm Bing has detected the IndexNow key file (it'll auto-discover within minutes after the engineer deploys it).

### 2.3 Verify IndexNow is firing (1 min)

After the engineer ships the IndexNow key file, the operator does one sanity check:

1. Hit `https://xyz.zilla.so/<indexnow-key>.txt` in a browser. You should see the key string echoed back as plaintext.
2. In Bing Webmaster → **Configure my site** → **IndexNow**, the dashboard should show "Active" within minutes.

### 2.4 Optional: verify the dynamic OG image

Open Twitter's [Card Validator](https://cards-dev.twitter.com/validator) or [Meta's Sharing Debugger](https://developers.facebook.com/tools/debug/) and paste a merchant URL like `https://xyz.zilla.so/blog/<some-post>`. The fetched preview should show the dynamic OG image (1200×630, branded). If you see Twitter's default fallback, the OG meta tags didn't ship — go back to the engineer.

---

## 3. Engineer implementation (~15 min after fork)

> The merchant template ships these files. This section explains what they do and which env vars matter.

### 3.1 Required env vars

```bash
# The merchant's public URL. Drives sitemap loc=, robots Sitemap=,
# OG image URLs, and JSON-LD canonical references. MUST be set per
# merchant — do not default to a hardcoded zilla.so subdomain.
NEXT_PUBLIC_APP_URL=https://xyz.zilla.so

# Google Search Console verification token from §2.1 step 5.
# Operator gives you this; it goes here and you redeploy. The token
# is harmless to commit but lives in env so it's swappable per merchant.
NEXT_PUBLIC_GOOGLE_VERIFICATION=...

# Bing Webmaster Tools verification token from §2.2 step 3. Optional —
# only needed if the engineer wants to regenerate public/BingSiteAuth.xml
# without re-typing the token. The committed XML file is what Bing
# actually reads.
NEXT_PUBLIC_BING_VERIFICATION_TOKEN=40759474A5E4B7C69E2658CAE1EBFD32

# IndexNow key — generate ONCE per merchant via:
#   node scripts/generate-indexnow-key.mjs
# That script writes the key to public/<key>.txt and prints
# the value to set here. Do NOT share keys across merchants — Bing
# will reject if a key file is hosted on multiple hosts.
NEXT_PUBLIC_INDEXNOW_KEY=c71002ac1e5d53ff0e1451911b9d9055

# Optional: brand name + business address used in JSON-LD and
# email footers. CAN-SPAM hard requirement on the email side.
BUSINESS_NAME=Sitebeat
BUSINESS_ADDRESS="123 Main St, Wilmington, DE 19801"
```

### 3.2 Files the template ships

| File | Purpose | Edit per merchant? |
| --- | --- | --- |
| `app/sitemap.ts` | Dynamic sitemap. Lists static pages by default; merchant adds catalog-driven entries (blog posts, programmatic SEO routes, etc.) below the static list. | Yes — add merchant-specific entries |
| `app/robots.ts` | robots.txt with `Sitemap:` line, sane disallow defaults | Rarely |
| `app/api/og/route.tsx` | Dynamic OG image generator at `/api/og?title=...&kicker=...` | Optional — tune brand colors |
| `public/BingSiteAuth.xml` | Bing verification file (Bing Webmaster Tools reads this at the domain root) | Generated by script |
| `scripts/generate-bing-auth-file.mjs` | Write `public/BingSiteAuth.xml` from the operator-supplied Bing token | Run once per merchant after operator gets token |
| `public/<NEXT_PUBLIC_INDEXNOW_KEY>.txt` | IndexNow verification file | Generated by script |
| `scripts/generate-indexnow-key.mjs` | Generate a unique key per merchant + write the file | Run once per fork |
| `scripts/indexnow-ping.mjs` | Submit all sitemap URLs to IndexNow (Bing/Yandex/Naver) | Run after every deploy with new pages |
| `app/layout.tsx` (`metadata.verification`) | Where the GSC + Bing meta tags get injected | No — env-driven |

### 3.3 Where to add programmatic SEO content

The template's `app/sitemap.ts` lists only the static marketing pages by default (`/`, `/pricing`, `/privacy`, `/terms`). When the merchant adds programmatic surfaces (free tools, vs/competitor pages, glossary, blog), add them to the sitemap by importing the catalog file and mapping its entries:

```ts
// Example from Sitebeat (sitebeat.tech)
import { TOOLS } from "@/lib/tools-catalog";
import { COMPETITORS } from "@/lib/competitors-catalog";
import { BLOG_POSTS } from "@/lib/blog-catalog";

const toolPages = TOOLS.map((t) => ({
  url: `${base}/tools/${t.slug}`,
  lastModified: now,
  changeFrequency: "monthly" as const,
  priority: 0.7,
}));
// ... etc.
```

The template ships placeholders so the merchant can add catalogs without editing the sitemap structure.

### 3.4 Per-page metadata pattern

Every public page should export a `generateMetadata` (or static `metadata`) with at minimum:

```ts
export const metadata: Metadata = {
  title: "...",
  description: "...",  // 120–160 chars
  alternates: { canonical: "/the-route" },
  openGraph: {
    title: "...",
    description: "...",
    images: [`/api/og?title=${encodeURIComponent(title)}&kicker=${encodeURIComponent("Brand")}`],
  },
};
```

For long-form content pages (blog posts, glossary terms, audit reports), also ship JSON-LD as a `<script type="application/ld+json">` element. Common types: `Article`, `BlogPosting`, `FAQPage`, `DefinedTerm`, `Organization`, `LocalBusiness`. See `app/blog/[slug]/page.tsx` in the Sitebeat repo for a working example.

---

## 4. IndexNow — accelerate indexation outside Google (5 min)

IndexNow is the protocol that lets Bing, Yandex, Naver, and a few others index pages within hours instead of weeks. **It's free, stupid-simple, and Google ignores it** — but Bing alone is 5–10% of US search traffic, so the win is real.

### 4.1 Generate the key (engineer, once per merchant fork)

```bash
node scripts/generate-indexnow-key.mjs
# Output:
#   ✓ Wrote public/c71002ac1e5d53ff0e1451911b9d9055.txt
#   Set NEXT_PUBLIC_INDEXNOW_KEY=c71002ac1e5d53ff0e1451911b9d9055 in Vercel env.
```

The script generates a 32-char hex key, writes the verification file to `public/<key>.txt` (so the file is served as a static asset at the right URL), and prints the env var to set. Commit both the file and the env var update.

### 4.2 Ping IndexNow with all sitemap URLs

After deploying the merchant or shipping a batch of new pages:

```bash
node scripts/indexnow-ping.mjs
```

The script fetches the live sitemap, extracts all `<loc>` URLs, chunks them into batches of 1,000, and POSTs each batch to `https://api.indexnow.org/indexnow` with the merchant's key. HTTP 200 means accepted. HTTP 403 with `SiteVerificationNotCompleted` means Bing hasn't verified the key file yet — wait 5 minutes and retry.

### 4.3 Optional: automate via cron

If the merchant ships content frequently (a weekly blog post, daily new audit reports), wire `scripts/indexnow-ping.mjs` into a cron. Either:

- **Vercel cron** — add an entry to `vercel.json` calling `/api/cron/indexnow` (which executes the same logic server-side)
- **Inngest cron** — add a function in `inngest/functions/` triggered weekly

Don't ping more than once per hour; some IndexNow endpoints rate-limit.

---

## 5. Operator's verification cheat-sheet

After the engineer ships and the operator has done §2.1–§2.3, run through this list once a week for the first month to confirm everything is healthy.

| Check | Where | Healthy state |
| --- | --- | --- |
| Sitemap fetched | GSC → Sitemaps | "Success" with URL count |
| Robots.txt fetched | GSC → Settings → Crawling | Last fetched within 24h |
| Index Coverage trending up | GSC → Pages | "Indexed" count growing weekly |
| IndexNow status | Bing Webmaster → Configure → IndexNow | "Active" |
| Bing Index growing | Bing Webmaster → Site Explorer | URL count climbing |
| OG image renders | Twitter Card Validator | Branded preview shows |

---

## 6. Multi-merchant ops (Zilla platform team)

These are concerns specific to running many merchants on a shared platform.

### 6.1 Sitemap aggregation

If you want a single roll-up sitemap covering every merchant on `*.zilla.so`, host an aggregator at `https://zilla.so/sitemap.xml` that emits a `<sitemapindex>` referencing each merchant's per-host sitemap:

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://xyz.zilla.so/sitemap.xml</loc></sitemap>
  <sitemap><loc>https://abc.zilla.so/sitemap.xml</loc></sitemap>
</sitemapindex>
```

Submit this to GSC under the `zilla.so` Domain property. Each merchant's individual property still gets its own sitemap submission for per-merchant analytics.

### 6.2 Granting operator access without exposing the portfolio

Each operator should have access only to their merchant's GSC + Bing properties — not to the parent zilla.so property. To enforce:

- **GSC**: Each merchant property has its own Users & Permissions list. Add the operator's email as a "Full" or "Restricted" user on their property only.
- **Bing**: Same model — each property's user list is independent.
- The platform team's email gets added to every merchant property as the safety net.

### 6.3 Hijack prevention

If you allow operators to set their own meta verification tokens, an operator who exits could use the still-valid token to claim a property they no longer own. Two mitigations:

- Rotate `NEXT_PUBLIC_GOOGLE_VERIFICATION` and `NEXT_PUBLIC_BING_VERIFICATION_TOKEN` when an operator leaves.
- Or: don't rely on per-merchant tokens — verify everything at `zilla.so` Domain level so the platform owns verification, and operators get URL-prefix access via GSC user grants instead.

The second approach is cleaner long-term. The first is fine until a merchant churns.

---

## 7. Common operator mistakes and how to fix them

### "Ownership verification failed" in GSC

You picked **Domain** verification but the engineer only shipped the HTML meta tag. Switch to **URL prefix** verification and try again. Or have the platform team add the DNS TXT record at `zilla.so`.

### "Invalid sitemap address" in GSC

You're in a Domain property and entered a relative path. Try the full URL `https://xyz.zilla.so/sitemap.xml`. Or you're in a URL-prefix property and entered a full URL — try just `sitemap.xml`.

### Sitemap shows 0 URLs

The merchant's `app/sitemap.ts` is returning an empty array, or `NEXT_PUBLIC_APP_URL` isn't set so it's falling back to a localhost URL that GSC can't fetch. Check the deploy logs.

### IndexNow ping returns 403

Bing hasn't verified the key file yet. Wait 5 minutes and retry. If it still fails, hit `https://xyz.zilla.so/<key>.txt` in a browser — the file must return HTTP 200 with the key as plaintext, no whitespace, no extra characters.

### Pages indexed but no impressions

You're indexed but not ranking for anything. This is **expected** for the first 4–8 weeks of a new domain — Google needs time to evaluate quality. Don't churn the SEO setup; wait.

### `manage.merchant.com` redirects to a registrar parking page

The custom domain isn't pointed at Vercel yet. Add the domain in Vercel project settings and follow the DNS instructions there.

---

## 8. What the template does NOT do (and shouldn't)

- **Keyword research / content strategy.** That's per-merchant work. The template gives you the plumbing; what you write is up to you.
- **Backlink building.** Out of scope for this doc.
- **Link redirects / 301 rewrites.** If the merchant migrates from an old domain, handle that in the merchant's own `next.config.ts` or middleware.
- **Internationalization (hreflang).** If the merchant ships in multiple languages, that's a separate setup; don't fold it in here.
- **AMP.** Deprecated as a ranking factor in 2021. Ignore.

---

## 9. Going fully autonomous (no operator clicks)

Everything in §2 (the operator runbook) can be eliminated for `*.zilla.so` subdomain merchants. The HQ-level pre-verification of `zilla.so` in GSC + Bing makes ownership of every subdomain inheritable — meaning the merchant template can add itself as a property + submit its sitemap + ping IndexNow with zero human action per merchant.

This is shipped:

- **`lib/seo/google-search-console.ts`** — minimal GSC API client (refresh-token OAuth, `addSite`, `submitSitemap`, `hasSite`, `listSites`)
- **`lib/seo/bing-webmaster.ts`** — Bing Webmaster API client (`addSite`, `submitSitemap`, `getSites`, `submitUrls`)
- **`lib/seo/indexnow.ts`** — IndexNow client (refactored from the standalone script for reuse from server code)
- **`lib/seo/bootstrap.ts`** — orchestrator: checks idempotency, runs all three providers, returns per-step results
- **`inngest/functions/seo-bootstrap.ts`** — daily cron at 04:00 UTC + manual `seo/bootstrap` event
- **`/api/admin/trigger?target=seo-bootstrap`** — operator manual trigger that runs inline (returns step-by-step results in the response body)
- **`/admin/seo`** — env-var readiness panel + one-click "Run SEO bootstrap" button

### How to enable for a new merchant

Once the Zilla HQ one-time setup is done (see [ZILLA_HQ_SETUP.md](./ZILLA_HQ_SETUP.md)), every new merchant just needs:

1. `node scripts/generate-indexnow-key.mjs` once
2. `NEXT_PUBLIC_APP_URL` set to the merchant's URL in Vercel
3. **`npm run seo:propagate`** — auto-pulls the four `ZILLA_*` HQ creds from an existing merchant and pushes them to every other merchant project in your Vercel scope. Pass `--targets newmerchant` to scope to just one. Idempotent — projects that already have the four vars are skipped (unless `--force`).
4. Deploy

After deploy, the bootstrap runs automatically at the next 04:00 UTC tick. Or the operator can hit `/admin/seo` → "Run SEO bootstrap" to fire it immediately.

The bootstrap, once fired, does all of this on the merchant's behalf:

- Adds the merchant URL as a property in Google Search Console
- Adds the merchant URL as a site in Bing Webmaster
- Verifies ownership (inherits from `zilla.so` for subdomain merchants; reads the `BingSiteAuth.xml` file for apex-domain merchants)
- Submits the sitemap to Google
- Submits the sitemap to Bing
- Pings IndexNow with every URL in the sitemap (real-time indexation across Bing/Yandex/Naver)

No operator clicks. No GSC dashboard. No Bing Webmaster UI. Each step is logged and visible at `/admin/seo` if you want to verify.

### What stays manual

Only the **one-time Zilla HQ setup** (verify `zilla.so` once, mint OAuth refresh token, generate Bing API key — see [ZILLA_HQ_SETUP.md](./ZILLA_HQ_SETUP.md)). After that, every merchant that ever forks the template gets autonomous SEO without any operator action.

For apex-domain merchants (`sitebeat.tech`, `realscale.app`, etc.), the operator can either run the manual flow in §2 once, or mint a per-merchant `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN` for autonomous bootstrap on that apex domain too.

---

## 10. Reference: what's deployed end-to-end

For a concrete reference, **Sitebeat** (the SEO-monitoring merchant) is a working implementation of every pattern in this doc:

- Live at `https://sitebeat.tech` (apex domain, not subdomain — but the patterns are identical).
- 600+ URL sitemap, GSC + Bing both verified.
- Programmatic SEO across `/seo-audit/[domain]`, `/tools/[slug]`, `/vs/[slug]`, `/alternatives/[slug]`, `/seo-for/[industry]/[city]`, `/seo-for/platform/[slug]`, `/glossary/[slug]`, `/for/[slug]`, `/blog/[slug]` — all sourced from catalog files in `lib/`.
- Dynamic OG images for blog posts and audit reports.
- IndexNow live, pinging Bing on every deploy.

Reading [github.com/Zilla-HQ/sitebeat](https://github.com/Zilla-HQ/sitebeat)'s `app/sitemap.ts`, `app/robots.ts`, `app/api/og/route.tsx`, `app/layout.tsx`, and `scripts/indexnow-ping.mjs` is the fastest way to understand how everything fits.
