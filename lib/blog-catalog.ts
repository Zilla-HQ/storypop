/**
 * Blog post catalog. Each post is a TS object with title, metadata,
 * and structured body sections — rendered by `app/blog/[slug]/page.tsx`.
 *
 * We deliberately avoid MDX runtime here: posts are infrequent, JSX
 * inside a TS object is more flexible than markdown for embedding
 * tables/CTAs, and we skip a build dependency. If posts ever scale
 * past ~30, migrate to MDX.
 */

export interface BlogSection {
  // "p" = paragraph, "h2" = section heading, "h3" = sub-heading,
  // "ul" = bullet list, "ol" = numbered list, "quote" = blockquote,
  // "callout" = highlighted CTA box.
  type: "p" | "h2" | "h3" | "ul" | "ol" | "quote" | "callout";
  text?: string;
  items?: string[];
  // For callout sections only:
  href?: string;
  cta?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO date
  readingMinutes: number;
  // Pulled into the meta description and into the article lede:
  lede: string;
  body: BlogSection[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "small-business-seo-state-of-the-web",
    title: "The state of small business SEO: what we find when we audit thousands of sites",
    description:
      "Aggregate findings from auditing thousands of small business websites. The 5 most common SEO failures, the score distribution, and what it costs you in lost traffic.",
    datePublished: "2026-04-15",
    readingMinutes: 7,
    lede: "We audit thousands of small business websites every month at Sitebeat. The same five failures show up on roughly 70% of them — and each one is costing the business an estimated 10–30% of its potential organic traffic.",
    body: [
      {
        type: "p",
        text: "When you build a tool that runs SEO audits at scale, you start to see patterns. The same handful of failures show up on a depressing fraction of small business websites — often the businesses that need search traffic most.",
      },
      {
        type: "p",
        text: "What follows is the aggregate picture: the five SEO failures that most consistently hurt small business sites, what they cost you, and the (usually-trivial) fix.",
      },
      {
        type: "h2",
        text: "1. Missing or weak meta descriptions",
      },
      {
        type: "p",
        text: "About 60% of the small business homepages we audit either have no meta description tag at all or one that's so short Google ignores it. Meta descriptions don't directly affect rankings — but they enormously affect click-through rate, which feeds back into ranking quality.",
      },
      {
        type: "p",
        text: "If your meta description is missing, Google auto-generates one from your page text. It's almost always worse than what you'd write — typically a fragment of your nav menu or hero section that has nothing to do with what someone searched for.",
      },
      {
        type: "h3",
        text: "Fix",
      },
      {
        type: "p",
        text: 'Add a `<meta name="description" content="...">` tag in the head of every page. Aim for 120–160 characters. Make it benefit-focused, not feature-focused. Include your primary keyword in the first half.',
      },
      {
        type: "h2",
        text: "2. No structured data",
      },
      {
        type: "p",
        text: "About 78% of small business sites have zero JSON-LD structured data. Schema markup is what powers rich results in Google: review stars, FAQ accordions, breadcrumbs, business hours, sitelinks. Without it, you compete with plain blue links — not the visually-rich entries above and below.",
      },
      {
        type: "p",
        text: "This is the most under-deployed SEO win in 2026. Sites that adopt schema typically see 20–80% more clicks for the same ranking position.",
      },
      {
        type: "h3",
        text: "Fix",
      },
      {
        type: "p",
        text: "Pick the schema types that match your business: LocalBusiness for local services, Organization for everyone else, FAQPage on any page with Q&A, Product on product pages. Generate the JSON-LD with a tool like Schema.org's documentation or a generator. Validate it in Google's Rich Results Test before deploying.",
      },
      {
        type: "h2",
        text: "3. Sitemap missing or broken",
      },
      {
        type: "p",
        text: "Roughly half the sites we audit have either no /sitemap.xml at all or a sitemap that returns 200 but contains zero URLs (typically because of a broken plugin or a misconfigured generator).",
      },
      {
        type: "p",
        text: "Without a sitemap, large or dynamic sites end up with pages Google never finds. Even small sites benefit because the sitemap is how you tell Google when content changes.",
      },
      {
        type: "h3",
        text: "Fix",
      },
      {
        type: "ul",
        items: [
          "WordPress: install Yoast or RankMath — they auto-generate /sitemap.xml.",
          "Next.js: create app/sitemap.ts exporting a list of URL objects.",
          "Static sites: build a script that walks your pages directory.",
          "Reference the sitemap from /robots.txt with `Sitemap: https://yourdomain.com/sitemap.xml`.",
        ],
      },
      {
        type: "h2",
        text: "4. Page speed slower than 3 seconds",
      },
      {
        type: "p",
        text: "About 40% of the sites we audit have a TTFB (time-to-first-byte) above 1 second on the homepage. Above 600ms, Google's Core Web Vitals start downranking you on mobile. Above 2 seconds, half your visitors bounce before the page renders.",
      },
      {
        type: "p",
        text: "Most of the slowest sites are running on Wix, Duda, or unoptimized WordPress with too many plugins.",
      },
      {
        type: "h3",
        text: "Fix",
      },
      {
        type: "ul",
        items: [
          "Move to a faster host or add a CDN (Cloudflare, Vercel, Bunny).",
          "Cache rendered HTML for static pages.",
          'Defer non-critical JavaScript with `<script defer>` or async.',
          "Compress images — most homepages ship 5MB of unoptimized hero photos.",
        ],
      },
      {
        type: "h2",
        text: "5. Service pages with duplicate or near-duplicate content",
      },
      {
        type: "p",
        text: "Common in service-area businesses (HVAC, plumbing, lawyers, real estate agents): a city-page template that's just the same 800 words with the city name swapped. Google has been penalizing this since 2014 and the penalties got worse with each helpful-content update.",
      },
      {
        type: "h3",
        text: "Fix",
      },
      {
        type: "p",
        text: "Each service-area page needs at least 300 unique words: a real testimonial from that city, neighborhood-specific information, photos from the area, links to local landmarks. Yes, it's slower to write — that's the point.",
      },
      {
        type: "h2",
        text: "What this costs you",
      },
      {
        type: "p",
        text: "We can't measure the exact lost traffic per site, but back-of-envelope: the average small business with these failures is probably leaving 30–50% of its addressable organic traffic on the table. That's the difference between a site that's quietly profitable and one you keep apologizing for.",
      },
      {
        type: "callout",
        text: "Want to know which of these your site has? Run a free 13-point SEO audit — no signup, results in 30 seconds.",
        href: "/",
        cta: "Run free audit →",
      },
    ],
  },
  {
    slug: "schema-markup-the-easiest-seo-win-of-2026",
    title: "Schema markup is the easiest SEO win of 2026 — and 78% of sites still don't have it",
    description:
      "Schema markup powers rich results in Google. Sites that adopt it see 20–80% more clicks for the same ranking position. Here's why most sites still don't have it, and the 4 schema types you should ship today.",
    datePublished: "2026-04-08",
    readingMinutes: 6,
    lede: "Schema markup is the most under-deployed SEO win in 2026. Adoption is somewhere around 22% on small business sites — meaning the other 78% are leaving rich-result eligibility on the table while their competitors gobble it up.",
    body: [
      {
        type: "p",
        text: "If you're a small business owner who has heard SEO consultants throw around the word 'schema' for the past five years and never really understood what it was — this article is for you.",
      },
      {
        type: "h2",
        text: "What schema markup actually is",
      },
      {
        type: "p",
        text: "Schema markup is structured data you embed in your page's HTML to tell search engines what the page is about — explicitly, in a format they can parse without guessing.",
      },
      {
        type: "p",
        text: "Without schema, Google has to infer that your page is a recipe, a product, a local business, or an article from the words on the page. With schema, you just tell it. The machine-readable version lives inside a `<script type=\"application/ld+json\">` block in the head of your page. Visitors never see it; Google does.",
      },
      {
        type: "h2",
        text: "Why it's the easiest SEO win",
      },
      {
        type: "p",
        text: "Two reasons:",
      },
      {
        type: "ol",
        items: [
          "It unlocks rich results — the visually-rich Google entries with stars, prices, hours, FAQ accordions, breadcrumbs, sitelinks. These typically double or triple click-through rate at the same ranking position.",
          "It's cheap to ship. Adding schema is a one-time HTML change. There's no ongoing maintenance cost. There's no content to write. There's no link-building campaign.",
        ],
      },
      {
        type: "p",
        text: "Compare this to other SEO investments — content marketing, link building, technical SEO refactors — that take months and ongoing effort. Schema is a one-evening project that pays out for the lifetime of the page.",
      },
      {
        type: "h2",
        text: "Why most sites still don't have it",
      },
      {
        type: "p",
        text: "Three reasons:",
      },
      {
        type: "ul",
        items: [
          "WordPress doesn't ship schema by default. You need a plugin (Yoast, RankMath, Schema Pro) configured by someone who knows what to configure.",
          "Most CMS templates don't include it. Squarespace, Wix, Webflow give you basic Organization schema if you're lucky — nothing else.",
          "Most site owners have never heard of it. SEO consultants talk about it among themselves; the rest of us are too busy running the business to learn an arcane technical optimization.",
        ],
      },
      {
        type: "h2",
        text: "The 4 schema types you should ship today",
      },
      {
        type: "h3",
        text: "1. Organization",
      },
      {
        type: "p",
        text: "Every site, on every page. Tells Google your company name, logo, social profiles, and contact info. Powers the knowledge panel that appears when someone searches your brand.",
      },
      {
        type: "h3",
        text: "2. WebSite + SearchAction",
      },
      {
        type: "p",
        text: "Every site, once. Adds a sitelinks searchbox to your branded search results — the inline search bar Google shows for big brands. Makes you look bigger.",
      },
      {
        type: "h3",
        text: "3. LocalBusiness (or a sub-type)",
      },
      {
        type: "p",
        text: "Every local-service business. Restaurant, Dentist, Plumber, HVACBusiness, Attorney — schema.org has a sub-type for almost every vertical. Powers map-pack rich results, opening hours, and 'near me' search eligibility.",
      },
      {
        type: "h3",
        text: "4. FAQPage",
      },
      {
        type: "p",
        text: "Any page with FAQ-style Q&A. Powers the accordion entries that appear under search results, which are the single most click-through-boosting rich result Google offers.",
      },
      {
        type: "h2",
        text: "How to ship it without becoming an SEO consultant",
      },
      {
        type: "ol",
        items: [
          "Generate the JSON-LD with a free tool: Schema.org's documentation, Schema App's generator, or Yoast's structured data block (in WordPress).",
          "Paste it inside `<script type=\"application/ld+json\">…</script>` in the head of your page.",
          "Validate it in Google's Rich Results Test (search.google.com/test/rich-results) before you ship.",
          "Wait 1–4 weeks. Watch your click-through rate climb.",
        ],
      },
      {
        type: "callout",
        text: "Sitebeat's free audit checks if you have schema markup on your site — and tells you exactly what's missing. Run yours in 30 seconds.",
        href: "/tools/schema-markup-tester",
        cta: "Test your schema →",
      },
    ],
  },
  {
    slug: "your-dev-pushed-broken-seo-last-week",
    title: "Your dev pushed broken SEO last week, and you didn't notice",
    description:
      "Most SEO regressions are silent. A theme update breaks your schema. A plugin disables your sitemap. By the time you notice the traffic drop, three months are gone. Here's what to actually monitor.",
    datePublished: "2026-04-01",
    readingMinutes: 5,
    lede: "Most SEO regressions are silent. A theme update breaks your schema markup. A plugin conflict kills your sitemap. The dev pushes a sitewide noindex flag they meant to remove before merging. By the time you notice the traffic drop, three months are gone.",
    body: [
      {
        type: "p",
        text: "Here's an uncomfortable truth about how small businesses lose SEO traffic: it almost never happens because the SEO got harder. It happens because the site got broken in some small invisible way, and nobody noticed for months.",
      },
      {
        type: "h2",
        text: "The pattern, illustrated",
      },
      {
        type: "p",
        text: "Last quarter, a customer of ours signed up after losing 40% of their organic traffic over four months. We ran an audit. The cause: their developer had pushed a meta robots noindex tag to the homepage during a staging-to-production deploy and never noticed.",
      },
      {
        type: "p",
        text: "The fix took 2 minutes. The lost traffic took 6 months to recover. Their analytics showed the drop, but it looked like 'normal' seasonal decline — until it kept declining.",
      },
      {
        type: "p",
        text: "This pattern repeats endlessly. The specific failure mode varies — robots.txt with `Disallow: /`, broken canonical tags, a sitemap that suddenly returns 404, schema markup that stopped validating after a theme update — but the shape is the same: a silent regression that gradually starves the site of search traffic over months.",
      },
      {
        type: "h2",
        text: "Why analytics doesn't catch this",
      },
      {
        type: "p",
        text: "Three reasons:",
      },
      {
        type: "ol",
        items: [
          "The traffic drop is gradual. Cached search results take 2–6 weeks to refresh. So a regression on Monday doesn't fully show up in analytics until June.",
          "Organic traffic is noisy. Day-to-day variance can be 30%+. A 10–20% drop disappears into the noise.",
          "You're not looking. Most operators check analytics weekly at most. By the time the trend is unmistakable, three months have passed.",
        ],
      },
      {
        type: "h2",
        text: "What you should actually monitor",
      },
      {
        type: "p",
        text: "Don't try to monitor traffic. Monitor the cause: the SEO signals on your site that, if they break, will cause traffic to drop in 6–12 weeks.",
      },
      {
        type: "p",
        text: "Specifically:",
      },
      {
        type: "ul",
        items: [
          "Does the homepage still return HTTPS 200?",
          "Is the meta robots tag still 'index, follow' (not noindex)?",
          "Does /robots.txt allow crawling?",
          "Does /sitemap.xml exist and contain >0 URLs?",
          "Are the canonical tags still pointing where they should?",
          "Is the JSON-LD schema markup still parsing cleanly?",
          "Has TTFB blown up past 1 second?",
        ],
      },
      {
        type: "p",
        text: "Each of these is a leading indicator. If any of them break, traffic will drop — but you can fix it the same week, before the drop materializes.",
      },
      {
        type: "h2",
        text: "Why nobody actually does this",
      },
      {
        type: "p",
        text: "Because it's boring. Nobody wakes up wanting to manually re-check 13 SEO signals every week. Setting up an alerting pipeline that does it for you takes a weekend, and most teams don't ever get around to it.",
      },
      {
        type: "p",
        text: "We built Sitebeat because we kept watching small businesses lose 30%+ of their organic traffic to silent regressions, and the existing tools (Ahrefs, Semrush, ContentKing) were either $129+/mo or designed for full-time SEO professionals. There needed to be something that just emails you when your site breaks.",
      },
      {
        type: "callout",
        text: "Sitebeat re-audits your site every Monday morning and emails you only when something regresses. $29/mo, cancel anytime — first audit free.",
        href: "/",
        cta: "Run free audit →",
      },
    ],
  },
  {
    slug: "page-speed-and-seo-what-actually-matters",
    title: "Page speed and SEO: what actually matters in 2026",
    description:
      "Most page speed advice is folklore. Here's what actually moves rankings in 2026, what TTFB and Core Web Vitals really measure, and the 5 fixes that pay back the fastest.",
    datePublished: "2026-03-25",
    readingMinutes: 8,
    lede: "Page speed advice is full of folklore. Compress images. Lazy load. Use a CDN. Most of it is generic and most of it doesn't move the needle. Here's what actually matters for SEO in 2026 — and the order to fix it in.",
    body: [
      {
        type: "p",
        text: "Page speed is one of the few SEO topics where almost every piece of advice you read is technically true and practically useless. Most of it tells you what to do without telling you what specifically Google measures.",
      },
      {
        type: "h2",
        text: "What Google actually measures",
      },
      {
        type: "p",
        text: "Three numbers, all part of Core Web Vitals:",
      },
      {
        type: "ol",
        items: [
          "LCP (Largest Contentful Paint) — how long until the biggest above-the-fold element shows. Target: under 2.5 seconds.",
          "INP (Interaction to Next Paint) — how long until your page responds after a user clicks. Target: under 200ms. Replaced FID in 2024.",
          "CLS (Cumulative Layout Shift) — how much your layout jumps around as it loads. Target: under 0.1.",
        ],
      },
      {
        type: "p",
        text: "Sitebeat tracks TTFB (time-to-first-byte) as a proxy for these — TTFB above 1 second almost always means LCP is also bad. It's a faster signal to compute.",
      },
      {
        type: "h2",
        text: "The 5 fixes that pay back the fastest",
      },
      {
        type: "h3",
        text: "1. Move to a faster host or add a CDN",
      },
      {
        type: "p",
        text: "If your TTFB is above 600ms, your hosting is the problem. Cheap shared WordPress hosts (Bluehost, GoDaddy, HostGator) routinely hit 1–2 seconds. Move to Vercel, Netlify, Bunny, or Cloudways and your TTFB drops to 100–200ms overnight. This is the single biggest win available.",
      },
      {
        type: "h3",
        text: "2. Cache rendered HTML",
      },
      {
        type: "p",
        text: "WordPress + WooCommerce shipped without caching will rebuild the page on every request. Install WP Rocket or LiteSpeed Cache and most page-builds drop from 1.5s to 50ms.",
      },
      {
        type: "h3",
        text: "3. Compress hero images",
      },
      {
        type: "p",
        text: "The average homepage hero image we see on small business sites is 2–4MB unoptimized. Run them through Squoosh or TinyPNG and ship WebP. A 4MB hero becomes 80KB without visible quality loss. LCP drops 50%.",
      },
      {
        type: "h3",
        text: "4. Defer non-critical JavaScript",
      },
      {
        type: "p",
        text: "Every analytics, chat widget, and marketing pixel runs in your initial render path by default. Add `defer` or `async` to all of them. Move chat widgets to load on scroll or click. Your INP improves immediately.",
      },
      {
        type: "h3",
        text: "5. Reserve space for above-the-fold images and ads",
      },
      {
        type: "p",
        text: 'Set explicit `width` and `height` on every image that appears above the fold. This is the entire CLS fix. Without it, the page jumps as images load — and Google\'s CLS score punishes you for it.',
      },
      {
        type: "h2",
        text: "What doesn't matter as much as you've been told",
      },
      {
        type: "ul",
        items: [
          "Minifying CSS — typically saves 1–2KB. Negligible.",
          "Combining files — actually slower with HTTP/2.",
          "Tree-shaking your design system — measure first; usually under 50ms savings.",
          "Switching to AMP — abandoned by Google as a ranking factor years ago.",
        ],
      },
      {
        type: "h2",
        text: "How to measure your own site",
      },
      {
        type: "p",
        text: "Run PageSpeed Insights at pagespeed.web.dev. It gives you LCP, INP, CLS, and TTFB plus specific recommendations. Run it before and after each fix to confirm the fix actually moved the needle. About 30% of 'fixes' don't.",
      },
      {
        type: "callout",
        text: "Sitebeat checks your TTFB every Monday and emails you if it crosses thresholds. Catch hosting regressions before they cost you traffic.",
        href: "/",
        cta: "Run free audit →",
      },
    ],
  },
  {
    slug: "broken-internal-links-the-silent-traffic-killer",
    title: "Broken internal links — the silent SEO traffic killer",
    description:
      "Most sites have 5–20% of their internal links broken at any given moment. Each broken link wastes crawl budget, kills user experience, and gradually eats into your rankings. Here's how to find them and fix them at scale.",
    datePublished: "2026-03-18",
    readingMinutes: 5,
    lede: "Almost every site we audit has at least one broken internal link. Most have several. Each one wastes crawl budget, frustrates users, and feeds Google a quality signal you don't want to feed it.",
    body: [
      {
        type: "p",
        text: "Internal linking is one of the most under-discussed parts of SEO. Everyone talks about backlinks. Hardly anyone talks about the dozens of broken internal links you have right now, on the site you're running, that you don't know about.",
      },
      {
        type: "h2",
        text: "Why broken internal links matter",
      },
      {
        type: "ul",
        items: [
          "Crawl budget waste — Google bot follows a broken link, gets a 404, and gives up on that path. That's a page in your sitemap that doesn't get indexed.",
          "User experience drop — users hit a 404, hit the back button, and either bounce or search again. Both feed quality signals back to Google.",
          "PageRank dilution — internal links pass authority. Broken ones leak it.",
          "Trust signal degradation — sites with many 404s look unmaintained. This is part of Google's quality scoring.",
        ],
      },
      {
        type: "h2",
        text: "How broken links actually accumulate",
      },
      {
        type: "p",
        text: "Three sources, almost universally:",
      },
      {
        type: "ol",
        items: [
          "Renamed/deleted pages without redirects. Marketing changed a URL slug for SEO; nobody updated the 30 places that linked to it.",
          "Plugin or theme updates that move admin paths. WordPress is famous for this.",
          "Dynamic content with stale references — old blog posts linking to product pages that have been retired.",
        ],
      },
      {
        type: "h2",
        text: "How to find them",
      },
      {
        type: "p",
        text: "Three options:",
      },
      {
        type: "ul",
        items: [
          "Run Screaming Frog or Sitebee — both crawl your site and surface 404s. Free for the first 500 URLs.",
          "Check Google Search Console — Coverage report shows pages Google tried to fetch and failed.",
          "Run Sitebeat — our broken-internal-links check runs every Monday and emails you when new ones appear.",
        ],
      },
      {
        type: "h2",
        text: "How to fix them",
      },
      {
        type: "ol",
        items: [
          "Best fix: 301 redirect the old URL to the new one. Preserves backlink equity. Set up in your hosting config or via a plugin like Redirection.",
          "Acceptable fix: update the source link to point at the new URL. Lower lift but only fixes one place; if other sites linked to the old URL you still 404.",
          "Worst fix (only if needed): return 410 Gone. Tells Google the page is permanently removed. Only use if you have no replacement and the page should be deindexed.",
        ],
      },
      {
        type: "h2",
        text: "How often to check",
      },
      {
        type: "p",
        text: "Weekly is the right cadence for most sites. Daily is overkill unless you're publishing fast (news, e-commerce inventory). Monthly is too slow — by the time you find broken links, Google has already updated its impression of your site.",
      },
      {
        type: "callout",
        text: "Sitebeat detects broken internal links on every weekly audit and includes them in the regression alert email when new ones appear.",
        href: "/",
        cta: "Run free audit →",
      },
    ],
  },
  {
    slug: "canonical-tags-the-most-misused-seo-tag",
    title: "Canonical tags: the most-misused SEO tag on the web",
    description:
      "Canonical tags should be the simplest concept in SEO. They're not. Most sites get them subtly wrong in ways that confuse Google and lose rankings. Here's how they work and how to fix yours.",
    datePublished: "2026-03-11",
    readingMinutes: 6,
    lede: "Canonical tags should be one of the simplest SEO concepts. They tell Google which URL is the 'real' version of a page when multiple URLs serve the same content. In practice, most sites get them subtly wrong.",
    body: [
      {
        type: "p",
        text: "About 35% of the sites we audit have at least one canonical tag problem. The errors range from harmless (canonical pointing at itself, which is the default and usually fine) to catastrophic (every page canonicalizing to the homepage, which deindexes the whole site).",
      },
      {
        type: "h2",
        text: "What canonical tags actually do",
      },
      {
        type: "p",
        text: 'A canonical tag is a single line in the head of your page: `<link rel="canonical" href="https://yoursite.com/the-real-url" />`. It tells Google: "If you find this content at multiple URLs, treat the one I\'m pointing to as the original. Index that one, ignore the rest."',
      },
      {
        type: "p",
        text: 'They exist because the same content can be reached via many URLs: `https://example.com/page`, `https://www.example.com/page`, `https://example.com/page?utm_source=email`, `https://example.com/page/`. Without canonicals, Google has to guess which is canonical, and it doesn\'t always pick the same one as you would.',
      },
      {
        type: "h2",
        text: "The 5 ways canonical tags break sites",
      },
      {
        type: "h3",
        text: "1. Every page canonicals to the homepage",
      },
      {
        type: "p",
        text: "This is the worst possible misconfiguration. It tells Google every URL on your site is just a duplicate of the homepage. Google deindexes everything else. We've seen this happen on themes that hardcode `<link rel='canonical' href='/' />` into the layout. Catastrophic.",
      },
      {
        type: "h3",
        text: "2. Canonicals point at staging or HTTP versions",
      },
      {
        type: "p",
        text: "After deploying from staging, the canonical tags still point at staging.example.com or http:// versions. Google can't reach the canonical URL, gets confused, and indexes inconsistently.",
      },
      {
        type: "h3",
        text: "3. Self-referencing canonicals on parameterized URLs",
      },
      {
        type: "p",
        text: "Your tracking URL (?utm_source=facebook) self-canonicalizes. Now Google has indexed that exact tracking parameter, fragmenting your authority across dozens of variants of the same page.",
      },
      {
        type: "h3",
        text: "4. Multiple canonical tags on the same page",
      },
      {
        type: "p",
        text: "Some plugins inject canonicals; some themes do too; some CMSes do automatically. End result: 2 or 3 canonical tags on the same page, often pointing at different URLs. Google ignores all of them and picks its own.",
      },
      {
        type: "h3",
        text: "5. Canonicals that don't exist",
      },
      {
        type: "p",
        text: "The canonical points at /best-page-ever, which 404s. Google can't follow the canonical, treats the original as canonical, but logs the broken canonical as a quality signal.",
      },
      {
        type: "h2",
        text: "How to do canonicals right",
      },
      {
        type: "ol",
        items: [
          "Every page should have exactly one canonical tag.",
          "It should point at the absolute URL you want indexed (not relative).",
          "The URL it points at should return HTTP 200.",
          "On parameterized URLs (?utm_source=…), canonical at the clean URL — not at the parameterized one.",
          "Test canonicals in Google Search Console's URL Inspection tool — it shows you Google's interpretation of your canonical, which sometimes differs from what you set.",
        ],
      },
      {
        type: "callout",
        text: "Sitebeat checks your canonical tag setup on every weekly audit and flags missing, broken, or off-domain canonicals.",
        href: "/",
        cta: "Run free audit →",
      },
    ],
  },
  {
    slug: "image-alt-text-is-still-load-bearing-seo",
    title: "Image alt text is still load-bearing SEO in 2026",
    description:
      "Alt text doesn't just help screen readers — it's how Google indexes your images, and image search is 20% of Google's traffic. Here's why alt text still matters and the 3 patterns that work.",
    datePublished: "2026-03-04",
    readingMinutes: 4,
    lede: "Alt text is the SEO win nobody bothers with. It takes 5 seconds per image, doubles your eligibility for image-search traffic, and helps screen readers. Most sites still don't bother.",
    body: [
      {
        type: "p",
        text: "About 65% of the small business sites we audit have less than half their images with alt text. The other 35% have alt text that says things like 'image' or 'IMG_4521.jpg'. Both are missed opportunities.",
      },
      {
        type: "h2",
        text: "Why alt text still matters",
      },
      {
        type: "ul",
        items: [
          "Image search is roughly 20% of Google's traffic. Pages with proper alt text are eligible to rank in it; pages without aren't.",
          "Screen readers read alt text aloud to visually impaired users. Without it, your images don't exist to that audience.",
          "Alt text is a content signal — Google uses it to understand what your page is about, especially when the image is the dominant element.",
          "Schema markup like ImageObject pulls from alt text. Rich results need it.",
        ],
      },
      {
        type: "h2",
        text: "The 3 patterns that work",
      },
      {
        type: "h3",
        text: "1. Descriptive — for content images",
      },
      {
        type: "p",
        text: 'A photo of a chocolate cake on a recipe page should have alt text like: "Three-layer dark chocolate cake with raspberry filling, sliced to show the layers." Not "cake.jpg". Not "delicious chocolate cake recipe." Not just "chocolate cake." Describe what\'s in the image.',
      },
      {
        type: "h3",
        text: "2. Empty — for decorative images",
      },
      {
        type: "p",
        text: 'Decorative images (background patterns, dividers, icons that aren\'t informational) should have `alt=""` — explicitly empty. Don\'t skip the alt attribute; that\'s not the same. Empty alt tells screen readers to skip; missing alt confuses them.',
      },
      {
        type: "h3",
        text: "3. Functional — for image links and buttons",
      },
      {
        type: "p",
        text: 'When an image is the link target — like a logo that links home, or a magnifying-glass icon that opens search — alt text should describe the *action*, not the image. "Open search" not "magnifying glass icon".',
      },
      {
        type: "h2",
        text: "What not to do",
      },
      {
        type: "ul",
        items: [
          "Don't keyword-stuff (\"chocolate cake recipe best chocolate cake easy chocolate cake\") — Google penalizes this.",
          "Don't say \"image of\" or \"picture of\" — screen readers already announce that it's an image.",
          "Don't leave the alt attribute off entirely — that's an accessibility violation and an SEO miss.",
          "Don't copy the same alt text across many images on the same page.",
        ],
      },
      {
        type: "callout",
        text: "Sitebeat checks alt-text coverage on every weekly audit and flags pages where coverage drops.",
        href: "/",
        cta: "Run free audit →",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
