/**
 * SEO glossary — programmatic pages targeting "what is X" search volume.
 *
 * Each entry generates a /glossary/[slug] page that ranks for the
 * term + variants ("what is canonical tag", "canonical tag meaning",
 * "canonical url SEO"). These are some of the highest-volume
 * top-of-funnel SEO queries on Google.
 */

export interface GlossaryTerm {
  slug: string;
  term: string;
  // The dominant intent the page targets (used in meta description):
  intent: string;
  // 1-sentence definition for the lede + meta description:
  definition: string;
  // 3–5 paragraph long-form explanation:
  body: string[];
  // Concrete examples or code/config snippets:
  examples?: { label: string; code?: string; text?: string }[];
  // Related terms to cross-link:
  related: string[];
  // FAQ schema-eligible questions:
  faq: { q: string; a: string }[];
  // Optional CTA hook tying back to a Sitebeat tool:
  toolHref?: string;
  toolCta?: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "canonical-tag",
    term: "Canonical tag",
    intent: "What a canonical tag is and how to use it",
    definition:
      "A canonical tag is an HTML link element that tells search engines which URL is the 'official' version of a page when the same content is reachable from multiple URLs.",
    body: [
      "Canonical tags exist because the same web page can be reached at many different URLs — with or without `www`, with or without a trailing slash, with various tracking parameters appended (`?utm_source=twitter`), or via different query orders. Without a canonical tag, search engines have to guess which URL is the 'real' one, and they often pick a different version than you would.",
      "By adding `<link rel=\"canonical\" href=\"https://yoursite.com/the-real-url\" />` to the `<head>` of a page, you explicitly tell crawlers: index this URL, treat all other variants as duplicates of it. This consolidates ranking authority into a single URL instead of fragmenting it across the duplicates.",
      "Canonical tags are advisory, not binding — Google will sometimes ignore your canonical if it disagrees (e.g., your declared canonical doesn't load, or contradicts your sitemap). For this reason, canonicals work best when they agree with your other signals: sitemap, internal links, and HTTP redirects all pointing at the same URL.",
    ],
    examples: [
      {
        label: "Self-referencing canonical (most pages should have this)",
        code: '<link rel="canonical" href="https://example.com/blog/post-slug" />',
      },
      {
        label: "Canonical pointing at the clean URL from a parameterized version",
        code: '<link rel="canonical" href="https://example.com/blog/post-slug" />\n<!-- on https://example.com/blog/post-slug?utm_source=twitter -->',
      },
    ],
    related: ["meta-tags", "sitemap", "robots-txt"],
    faq: [
      {
        q: "Should every page have a canonical tag?",
        a: "Yes. Even self-referencing canonicals (where the canonical URL is the same as the current URL) are useful — they prevent accidental duplicate indexing if someone links to your page with weird query parameters.",
      },
      {
        q: "What happens if I have multiple canonical tags on a page?",
        a: "Google ignores all of them and picks its own canonical. Always have exactly one canonical tag per page.",
      },
      {
        q: "Can a canonical tag point at a different domain?",
        a: "Yes — this is called cross-domain canonicalization. Useful for syndicated content. Google will treat the cross-domain canonical as the source.",
      },
    ],
    toolHref: "/blog/canonical-tags-the-most-misused-seo-tag",
    toolCta: "Read our deep-dive on canonical tag mistakes →",
  },
  {
    slug: "meta-description",
    term: "Meta description",
    intent: "What a meta description is and why it matters for SEO",
    definition:
      "A meta description is a short HTML attribute that summarizes a page's content. Search engines use it as the gray text under your title in search results.",
    body: [
      "The meta description doesn't directly affect rankings — Google has been clear about this since 2009. But it strongly affects click-through rate, which feeds back into ranking quality signals. A well-written meta description can lift CTR by 30–50% compared to Google auto-generating one from page text.",
      "Meta descriptions sit in the `<head>` of a page as `<meta name=\"description\" content=\"...\">`. The optimal length is 120–160 characters. Above 160, Google truncates. Below 50, Google often discards your description and substitutes its own.",
      "Each page should have a unique meta description. Duplicates dilute click-through across all pages that share them. Most CMSes (WordPress, Shopify, Webflow) have plugin or template fields for per-page descriptions.",
    ],
    examples: [
      {
        label: "Good — descriptive, benefit-focused, 130 characters",
        code: '<meta name="description" content="Free SEO audit: drop your URL, get a graded report in 30 seconds across 13 SEO checks. No signup required." />',
      },
      {
        label: "Bad — keyword stuffing, no benefit, 250 characters",
        code: '<meta name="description" content="SEO audit SEO check SEO checker SEO tool best SEO audit free SEO audit website SEO audit small business SEO audit local SEO audit..." />',
      },
    ],
    related: ["title-tag", "meta-tags", "click-through-rate"],
    faq: [
      {
        q: "Does meta description affect rankings directly?",
        a: "No. But it affects click-through rate, which Google uses as a quality signal. Indirect ranking impact is real.",
      },
      {
        q: "Why isn't my meta description showing in Google?",
        a: "Google substitutes its own snippet about 40% of the time when it judges yours doesn't match user intent. Write descriptions that match how people actually search.",
      },
      {
        q: "How long should a meta description be?",
        a: "120–160 characters. Above 160 gets truncated; below 50 often gets replaced.",
      },
    ],
    toolHref: "/tools/meta-description-checker",
    toolCta: "Check your meta description →",
  },
  {
    slug: "title-tag",
    term: "Title tag",
    intent: "What a title tag is and how to optimize it",
    definition:
      "The title tag is an HTML element that defines a page's title. It's the blue link shown in search results and the most important on-page SEO signal you control.",
    body: [
      "The title tag lives in the `<head>` of a page as `<title>Your Page Title</title>`. It's the single most important on-page SEO signal — both the headline shown in search results and the keyword anchor that Google uses to decide what your page is about.",
      "Optimal title tags are 50–60 characters with the primary keyword near the start. Longer titles get truncated mid-word in search results, killing click-through. Shorter titles leave keyword relevance signal on the table.",
      "Each page should have a unique title that describes that specific page — not just the brand name with no context. Generic titles ('Home — Brand', 'About Us', 'Contact') waste the highest-value real estate on your site.",
    ],
    examples: [
      {
        label: "Good — keyword-led, 56 characters, brand at the end",
        code: "<title>Free SEO Audit Tool — 13 Checks in 30 Seconds — Sitebeat</title>",
      },
      {
        label: "Bad — generic, brand-led, no keyword",
        code: "<title>Home | Sitebeat</title>",
      },
    ],
    related: ["meta-description", "h1-tag", "click-through-rate"],
    faq: [
      {
        q: "How long should a title tag be?",
        a: "50–60 characters. Google's display window is roughly 580 pixels of text — a few wide letters (W, M, capitals) eat the budget faster.",
      },
      {
        q: "Why does Google rewrite my title?",
        a: "About 60% of titles get rewritten. Common causes: stuffing the same keyword multiple times, including the brand twice, exceeding 60 chars, or using a title that doesn't match the page content.",
      },
      {
        q: "Can different pages have the same title?",
        a: "Technically yes, but it's a waste — Google will only rank one of them and may treat the others as low-quality.",
      },
    ],
    toolHref: "/tools/title-tag-checker",
    toolCta: "Check your title tag →",
  },
  {
    slug: "schema-markup",
    term: "Schema markup",
    intent: "What schema markup is and why it powers rich results",
    definition:
      "Schema markup is structured data added to your HTML that explicitly tells search engines what type of content a page contains — and what specific entities (products, events, recipes, businesses) appear on it.",
    body: [
      "Schema markup uses a vocabulary defined at schema.org, embedded in your HTML using JSON-LD format. It tells Google explicitly what the page is about, instead of forcing Google to infer from page text.",
      "The payoff is rich results — the visually-rich entries Google shows above and below plain blue links: review stars, FAQ accordions, event date cards, product price snippets, sitelinks, recipe images, and breadcrumbs. Pages with appropriate schema markup typically see 20–80% higher click-through rates at the same ranking position.",
      "Schema markup doesn't directly boost rankings. But the rich results it unlocks dramatically increase clicks, and clicks feed back into Google's ranking quality signals. It's one of the highest-leverage one-time SEO investments available — ship it once, benefit for the lifetime of the page.",
    ],
    examples: [
      {
        label: "Organization schema (every site, every page)",
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Sitebeat",
  "url": "https://sitebeat.tech"
}
</script>`,
      },
      {
        label: "FAQPage schema (any page with Q&A)",
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is schema markup?",
    "acceptedAnswer": { "@type": "Answer", "text": "..." }
  }]
}
</script>`,
      },
    ],
    related: ["json-ld", "rich-results", "structured-data"],
    faq: [
      {
        q: "Does schema markup boost rankings?",
        a: "Not directly. But the rich results it unlocks dramatically increase click-through rate, and CTR feeds into ranking quality signals.",
      },
      {
        q: "Which schema types should I use?",
        a: "Organization (every site), WebSite + SearchAction (sitelinks searchbox), Article on content pages, Product on product pages, LocalBusiness for local services, FAQPage on FAQ-heavy pages.",
      },
      {
        q: "Can bad schema get my site penalized?",
        a: "Yes if it's deceptive — e.g., AggregateRating schema on a page with no real reviews. Stick to honest schema for content that actually exists on the page.",
      },
    ],
    toolHref: "/tools/schema-markup-tester",
    toolCta: "Test your schema →",
  },
  {
    slug: "robots-txt",
    term: "Robots.txt",
    intent: "What robots.txt does and how to configure it correctly",
    definition:
      "Robots.txt is a plaintext file at the root of your domain that tells search engine crawlers which paths they're allowed to crawl. It's the first file Google fetches before any HTML.",
    body: [
      "Every domain should have a `/robots.txt` file. It serves two purposes: blocking crawlers from paths they shouldn't index (admin panels, search result pages, private user areas), and pointing crawlers at your sitemap so they know where to find your pages.",
      "The most catastrophic robots.txt mistake is shipping `Disallow: /` from a staging environment to production. This single line tells every crawler to skip the entire site, and Google will deindex you within weeks. Always verify robots.txt after deploys.",
      "Robots.txt is not a security mechanism — anyone can read it, and ignoring it is trivial. Use it for crawler etiquette, not for protecting sensitive content. Sensitive paths should be behind authentication.",
    ],
    examples: [
      {
        label: "Minimal valid robots.txt",
        code: `User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml`,
      },
      {
        label: "DANGER — never ship this to production",
        code: `User-agent: *
Disallow: /`,
      },
    ],
    related: ["sitemap", "crawl-budget", "noindex"],
    faq: [
      {
        q: "Do I need a robots.txt?",
        a: "Technically no — without one, Google assumes everything is crawlable. But you lose the ability to point Google at your sitemap and block bot-spam paths. Always have one.",
      },
      {
        q: "How do I block AI crawlers like GPTBot?",
        a: "Add `User-agent: GPTBot` block followed by `Disallow: /`. Doesn't affect Google rankings — only AI training crawlers.",
      },
      {
        q: "Why isn't my robots.txt update showing up in Google?",
        a: "Google caches robots.txt for up to 24 hours. Wait a day, then test in Google Search Console's robots.txt tester.",
      },
    ],
    toolHref: "/tools/robots-txt-validator",
    toolCta: "Validate your robots.txt →",
  },
  {
    slug: "sitemap",
    term: "Sitemap (XML)",
    intent: "What a sitemap is and why search engines need one",
    definition:
      "An XML sitemap is a structured list of all the pages on your site, formatted so search engines can quickly discover what exists and when it changed.",
    body: [
      "Sitemaps live at `/sitemap.xml` (by convention). They contain a `<url>` entry for every page, with optional `<lastmod>`, `<changefreq>`, and `<priority>` hints. Search engines use the sitemap to discover pages they wouldn't otherwise find — especially on large sites or sites with deep navigation.",
      "Without a sitemap, large or dynamic sites end up with pages Google never crawls. Even small sites benefit because the sitemap is how you tell Google when content was updated, which can speed up re-indexing of changed pages.",
      "Sitemaps have a 50,000-URL or 50MB-uncompressed cap per file. Above that, use a sitemap index (`<sitemapindex>`) that points to multiple child sitemaps. Most CMSes auto-generate sitemaps via plugins (Yoast for WordPress, built-in for Shopify and Webflow).",
    ],
    examples: [
      {
        label: "Minimal sitemap with one URL",
        code: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-05-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
      },
    ],
    related: ["robots-txt", "indexing", "crawl-budget"],
    faq: [
      {
        q: "Do I need a sitemap if my site is small?",
        a: "If you have under 50 pages all linked from your homepage, Google will find them without one. Above 50 pages, or pages reachable only via internal search, a sitemap is required for full indexing.",
      },
      {
        q: "How often should I update my sitemap?",
        a: "Whenever pages are added, removed, or significantly updated. Most CMSes do this automatically.",
      },
      {
        q: "Should I include image and video URLs?",
        a: "Yes — `<image:image>` and `<video:video>` extensions help Google index media that would otherwise be missed.",
      },
    ],
    toolHref: "/tools/sitemap-validator",
    toolCta: "Validate your sitemap →",
  },
  {
    slug: "core-web-vitals",
    term: "Core Web Vitals",
    intent: "What Core Web Vitals measure and how to improve them",
    definition:
      "Core Web Vitals are Google's set of three page-experience metrics — LCP, INP, and CLS — that directly affect mobile search rankings.",
    body: [
      "Core Web Vitals measure three aspects of perceived page performance: Largest Contentful Paint (how fast the biggest above-the-fold element loads), Interaction to Next Paint (how fast the page responds when a user clicks), and Cumulative Layout Shift (how much the layout jumps around as it loads).",
      "Each metric has a 'good', 'needs improvement', and 'poor' threshold. Pages with all three in 'good' get a small mobile ranking boost. Pages with any in 'poor' get a small mobile demotion. The signals are real but modest — they tip the scales between similarly-ranked pages.",
      "The fastest path to good Core Web Vitals: faster hosting (cuts LCP), defer non-critical JavaScript (cuts INP), reserve space for images and ads (cuts CLS). These three changes alone fix Core Web Vitals on most sites.",
    ],
    examples: [
      {
        label: "Target thresholds (good)",
        text: "LCP under 2.5s · INP under 200ms · CLS under 0.1",
      },
    ],
    related: ["page-speed", "lcp", "inp", "cls"],
    faq: [
      {
        q: "How much do Core Web Vitals affect rankings?",
        a: "Modest impact — Google itself describes them as a tie-breaker. But they're load-bearing in mobile rankings, where roughly 60% of search happens.",
      },
      {
        q: "Where do I check my Core Web Vitals?",
        a: "Run pagespeed.web.dev or check the Core Web Vitals report in Google Search Console (uses real Chrome user data).",
      },
      {
        q: "What's the fastest way to improve Core Web Vitals?",
        a: "Move to faster hosting (or add a CDN). It's the single biggest improvement available on most sites.",
      },
    ],
    toolHref: "/blog/page-speed-and-seo-what-actually-matters",
    toolCta: "Read our page speed deep-dive →",
  },
  {
    slug: "alt-text",
    term: "Alt text",
    intent: "What alt text is and why it matters for SEO + accessibility",
    definition:
      "Alt text is a short text description of an image, embedded in HTML via the `alt` attribute on the `<img>` tag. It's read by screen readers and used by search engines to understand image content.",
    body: [
      "Alt text serves two purposes simultaneously. For accessibility, it's how visually-impaired users hear your images via screen readers. For SEO, it's how Google understands what an image depicts — which determines whether the image can rank in image search (~20% of Google's traffic).",
      "Good alt text is descriptive and specific. Bad alt text is generic ('image', 'photo'), file-name junk ('IMG_4521.jpg'), or absent entirely. Decorative images should have empty alt (`alt=\"\"`) — explicitly empty tells screen readers to skip; missing alt confuses them.",
      "Alt text is also the source for `ImageObject` schema markup, which powers rich image results. Pages with thoroughly captioned images often gain visibility in image-search-driven traffic that's invisible to your text-search analytics.",
    ],
    examples: [
      {
        label: "Good — descriptive content image",
        code: '<img src="/cake.jpg" alt="Three-layer dark chocolate cake with raspberry filling, sliced to show the layers">',
      },
      {
        label: "Good — decorative image",
        code: '<img src="/divider.svg" alt="">',
      },
      {
        label: "Bad — generic, useless to both screen readers and search",
        code: '<img src="/cake.jpg" alt="image">',
      },
    ],
    related: ["accessibility", "image-seo", "schema-markup"],
    faq: [
      {
        q: "Do I need alt text on every image?",
        a: "Yes. Decorative images get empty alt (`alt=\"\"`); content images get descriptive alt. Never skip the attribute entirely.",
      },
      {
        q: "Can alt text help with rankings?",
        a: "Yes — both for image search (direct) and for content relevance (Google reads alt text as on-page content).",
      },
      {
        q: "Should I keyword-stuff alt text?",
        a: "No. Google penalizes obvious stuffing. Write naturally; relevant keywords appearing organically is fine, repetition is not.",
      },
    ],
    toolHref: "/blog/image-alt-text-is-still-load-bearing-seo",
    toolCta: "Read our alt text deep-dive →",
  },
  {
    slug: "open-graph",
    term: "Open Graph (OG) tags",
    intent: "What Open Graph tags do and why social shares look broken without them",
    definition:
      "Open Graph (OG) tags are HTML meta tags that control how a URL renders when shared on Facebook, LinkedIn, X/Twitter, Slack, iMessage, and most messaging platforms.",
    body: [
      "Open Graph was created by Facebook in 2010 and adopted by every major social and messaging platform. When you paste a URL into a chat, the unfurled preview — title, description, image — is pulled from OG tags in the page's `<head>`.",
      "Without OG tags, social platforms fall back to generic heuristics: the page title becomes whatever's in `<title>`, the description becomes random text from the page, and the image becomes whatever the platform finds first. Results range from 'unimpressive' to 'broken'.",
      "Twitter/X has its own card system that overrides OG tags when present. The two are typically used together — OG tags as the cross-platform default, Twitter-specific tags when you want differentiated rendering on X.",
    ],
    examples: [
      {
        label: "Minimum viable OG tag set",
        code: `<meta property="og:title" content="Page title">
<meta property="og:description" content="Short summary, ~140 chars">
<meta property="og:image" content="https://example.com/share.png">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="article">`,
      },
    ],
    related: ["meta-tags", "social-sharing", "twitter-card"],
    faq: [
      {
        q: "Do Open Graph tags affect SEO rankings?",
        a: "No, not directly. But they affect social click-through, which can drive traffic that indirectly feeds engagement signals back to Google.",
      },
      {
        q: "What size should the og:image be?",
        a: "1200×630 pixels is the modern standard. Most platforms render this size correctly without cropping awkwardly.",
      },
      {
        q: "Why isn't my LinkedIn share showing my OG image?",
        a: "LinkedIn caches OG data aggressively. Use the LinkedIn Post Inspector to force a re-fetch.",
      },
    ],
  },
  {
    slug: "domain-authority",
    term: "Domain Authority",
    intent: "What Domain Authority is and whether it matters",
    definition:
      "Domain Authority (DA) is a 0–100 score created by Moz that estimates how well a domain will rank in Google search results. It's a third-party metric, not a Google signal.",
    body: [
      "Domain Authority is sometimes confused with a Google ranking signal — it isn't. It's Moz's proprietary score, calculated from their backlink index, and meant as a relative comparison tool. A DA-50 site will likely outrank a DA-20 site in similar topic areas, but DA itself doesn't appear in Google's algorithm.",
      "Other SEO tools have their own equivalents: Ahrefs' Domain Rating (DR), Semrush's Authority Score, Majestic's Trust Flow. They're all backlink-graph-derived approximations of authority, and they correlate with rankings without causing them.",
      "For most small businesses, Domain Authority is a vanity metric — useful for tracking trend, useless for tactical decisions. The actionable signals are: do you rank for the keywords your customers search, do those rankings convert to traffic, does that traffic convert to revenue. DA is a lagging proxy for the first.",
    ],
    examples: [
      {
        label: "Typical DA ranges",
        text: "0–30: new sites, weak backlink profiles. 30–50: established small businesses. 50–70: substantial authority sites. 70+: major publishers, large brands.",
      },
    ],
    related: ["domain-rating", "backlinks", "authority"],
    faq: [
      {
        q: "Is Domain Authority a Google ranking factor?",
        a: "No. DA is Moz's proprietary metric. Google has its own internal authority signals which they don't expose.",
      },
      {
        q: "How do I increase Domain Authority?",
        a: "Earn backlinks from authoritative sites. There are no shortcuts — paid link schemes are penalized.",
      },
      {
        q: "Should I obsess over DA?",
        a: "No. Track it as a lagging indicator if you want, but optimize for traffic and conversions, not DA score.",
      },
    ],
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.slug === slug);
}
