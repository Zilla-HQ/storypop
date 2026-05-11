# Distribution surfaces — extension + WordPress plugin + teardown content

Beyond cold email and paid ads, the reference [Sitebeat](https://github.com/Zilla-HQ/sitebeat) build ships three lightweight distribution surfaces — each is a compounding channel that doesn't depend on operator headcount once published. They're scaffolded in the template; you re-skin per merchant.

---

## 1. Chrome MV3 extension

**Path:** `extension/` — `manifest.json`, `popup.html`, `popup.js`, `icons/`.

A Manifest V3 browser-action extension that wraps the merchant's core hook. Sitebeat's extension is a one-click "audit this page" against the public `/api/audit` endpoint; for a different vertical it becomes "stage this listing," "summarize this PDF," "generate copy for this product," etc.

### How to re-skin

1. Open `extension/manifest.json`. Update `name`, `description`, `homepage_url`, `host_permissions`, and the popup URL.
2. Open `extension/popup.html` + `popup.js`. The popup posts to your merchant's public API endpoint with the current tab URL. Swap the endpoint + result rendering for your merchant's hook.
3. Run `node scripts/generate-extension-icons.mjs` after dropping a 512×512 brand mark into the script's input — it regenerates the 16/32/48/128 icons at the right sizes for the Chrome Web Store. Edit the source SVG / PNG path inside the script.

### Publishing

1. `cd extension && zip -r extension.zip . -x '*.DS_Store'`
2. Upload at <https://chrome.google.com/webstore/devconsole/>.
3. Web Store review usually clears in 1–3 business days.
4. Costs $5 (one-time developer registration).

### Why this is worth shipping

Once published, the listing is permanent inventory in the Chrome Web Store's category surfaces. Even modest install counts (~100 over 30 days) compound — install-to-paid conversion on a focused tool is materially higher than ad-driven cold traffic because the user already had your hook open in a tab.

---

## 2. WordPress plugin

**Path:** `wordpress-plugin/sitebeat/` (rename folder per merchant) — PHP plugin with an admin dashboard that calls the merchant's public API.

Sitebeat's plugin lets WordPress admins audit their own site from `/wp-admin` and embed the result on a public page. The same shape works for any merchant whose hook is `URL in → result out`:

- Real-estate merchant: "preview this property page"
- Copy merchant: "rewrite this product description"
- Compliance merchant: "scan this page for accessibility issues"

### How to re-skin

1. Rename the plugin folder (e.g. `wordpress-plugin/sitebeat/` → `wordpress-plugin/<your-merchant>/`).
2. Update `style.css` / `plugin.php` (or whatever the entry file is named — see `wordpress-plugin/README.md`) header block: `Plugin Name`, `Description`, `Author`, `Plugin URI`, `Version`.
3. Wire the admin dashboard's API call to your merchant's `/api/<hook>` endpoint.
4. Update the WordPress admin menu copy, dashboard widget, and shortcode handler.

### Publishing

1. Submit to <https://wordpress.org/plugins/developers/add/>. Review is slow (1–2 weeks first time, days for updates).
2. SVN repo after approval — no GitHub direct sync.
3. Free; the WordPress plugin directory is itself a major traffic source for installs.

### Why this is worth shipping

WordPress runs ~40% of the web. A plugin install becomes a recurring touchpoint — your icon is in the customer's WP admin sidebar every time they log in to write a post. Strong retention surface.

---

## 3. Teardown script — content marketing

**Path:** `scripts/teardown.mjs` + `docs/sample-teardown.md`.

The teardown script takes a list of well-known domains, runs the merchant's hook against each, and emits a markdown report suitable for Twitter / LinkedIn / blog posts. Sitebeat uses it to audit 10 major media sites and publish "here's what's broken on $BIG_BRAND's site." For other merchants it generalizes to:

- Photo merchant: "before/after restage of 10 stale Zillow listings"
- Copy merchant: "10 fortune-500 product descriptions, rewritten"
- Compliance merchant: "ADA scan of 10 government homepages"

### Setup

1. Edit the domain list at the top of `scripts/teardown.mjs` — pick recognizable targets that fit your merchant's hook.
2. Run `node --env-file=.env.production scripts/teardown.mjs > docs/teardown-2026-XX.md`.
3. Review the generated markdown, copy the top 3–5 findings into a thread / post.

### Distribution playbook

- **X / Twitter**: 1 thread per teardown report (5–8 tweets). Pin to profile.
- **LinkedIn**: long-form post + carousel of screenshots.
- **HackerNews**: Show HN for the first teardown only (one shot — don't repeat).
- **Reddit**: relevant subreddit per teardown's audience (r/SEO, r/realestate, r/Entrepreneur, etc.). One per subreddit max — be helpful, not spammy.

### Why this is worth shipping

Each teardown is a content artifact + reverse-attribution lure (a recognizable brand will sometimes reply or repost). The report itself often becomes an SEO surface — Sitebeat publishes its teardowns under `/blog/<slug>` which feeds the catalog pattern from [SEO.md](./SEO.md).

---

## Order of operations for a new merchant

1. Ship the core funnel + cold-outreach loop first (see `SETUP.md`).
2. Then the X account + paid ads (`X.md`, `META_ADS.md`).
3. Then programmatic SEO (`SEO.md`).
4. **Then this doc** — distribution surfaces are growth multipliers, not foundation. They're a 1-week build each (mostly re-skinning), but they assume your funnel converts.

Don't ship a Chrome extension before your `/api/audit`-equivalent endpoint is solid — every install becomes a permanent visible-error surface.

---

## Reference implementation

See [`Zilla-HQ/sitebeat`](https://github.com/Zilla-HQ/sitebeat) — `extension/`, `wordpress-plugin/sitebeat/`, `scripts/teardown.mjs`. The Sitebeat versions ship live; clone and re-skin.
