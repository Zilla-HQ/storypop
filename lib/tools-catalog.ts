/**
 * Catalog of free /tools/* pages. Each entry seeds:
 *   - the /tools index card
 *   - the per-tool page (long-form content + interactive form)
 *   - the sitemap.
 */

export interface ToolDef {
  slug: string;
  toolId: string;
  shortName: string;
  longName: string;
  oneLiner: string;
  ctaCopy: string;
  // Long-form content blocks rendered below the form. Each is `{ heading, body }`
  // — body is markdown-ish but rendered as plain paragraphs with bold for **text**.
  why: string;
  goodPattern: string[];
  badPattern: string[];
  fix: string[];
  faq: { q: string; a: string }[];
}

export const TOOLS: ToolDef[] = [
  {
    slug: "meta-description-checker",
    toolId: "meta-description",
    shortName: "Meta Description Checker",
    longName: "Free Meta Description Checker",
    oneLiner:
      "Pull any homepage's meta description, check the length against Google's display window, and get a one-paragraph fix instruction if it's missing or wrong.",
    ctaCopy: "Check description",
    why:
      "The meta description is the gray text under your title in Google results. Pages without one get an auto-generated snippet pulled from random page text — which almost never matches search intent. A well-crafted 120–160 character description is one of the highest-leverage SEO changes you can make: it doesn't change rankings directly, but it lifts click-through rate, which Google uses as a quality signal that does affect rankings.",
    goodPattern: [
      "120–160 characters",
      "Includes the primary keyword in the first half",
      "Reads like a benefit, not a list of features",
      "Unique per page (homepage description ≠ contact page description)",
    ],
    badPattern: [
      "Missing entirely (Google falls back to whatever it can find)",
      "Truncated under 50 characters",
      "Stuffed with keywords with no readable sentence",
      "Identical across every page on the site",
    ],
    fix: [
      "Open the page's <head> section.",
      "Add (or update) a `<meta name=\"description\" content=\"...\">` tag.",
      "Write a 120–160 character description that states what the page is and why it matters.",
      "Don't include your domain name — it's already in the URL beneath.",
    ],
    faq: [
      {
        q: "Does meta description affect rankings?",
        a: "Not directly — Google has been clear about this since 2009. But it strongly affects click-through rate, and click-through rate is one of the inputs Google's ranking algorithms use to evaluate quality. Indirectly, yes.",
      },
      {
        q: "Why is my meta description not showing in Google?",
        a: "Google substitutes its own snippet about 40% of the time when it judges yours doesn't match the user's query well. To reduce this: write descriptions that match how people actually search, not how you describe the page internally.",
      },
      {
        q: "Should every page have a unique description?",
        a: "Yes. Duplicate descriptions across pages dilute click-through rate on every one of them. Most CMSes (WordPress, Shopify, Webflow) have plugins or fields for per-page descriptions.",
      },
    ],
  },
  {
    slug: "title-tag-checker",
    toolId: "title-tag",
    shortName: "Title Tag Checker",
    longName: "Free Title Tag Length Checker",
    oneLiner:
      "Check your homepage <title> tag length against Google's 50–60 character display limit. Pulls the live tag and tells you if it'll be truncated.",
    ctaCopy: "Check title",
    why:
      "Your <title> tag is the single biggest on-page SEO signal you control. It's the blue link in search results — both the headline and the keyword anchor that Google uses to decide what your page is about. Titles longer than ~60 characters get truncated mid-word in search results, which kills click-through. Shorter than 30 and you're leaving relevance signal on the table.",
    goodPattern: [
      "30–60 characters",
      "Primary keyword near the start",
      "Brand name at the end (or omitted on long titles)",
      "Different per page — never just the brand",
    ],
    badPattern: [
      "Missing or empty title",
      "Just the company name with nothing else",
      "Over 60 characters (will truncate)",
      "Identical across every page",
    ],
    fix: [
      "Find the `<title>` tag in your page's <head>.",
      "Rewrite it to the format: `Primary keyword phrase — Brand`.",
      "Keep total length between 50 and 60 characters.",
      "Use a different title on every page; auto-generate from H1 if you must.",
    ],
    faq: [
      {
        q: "How long should my title tag be?",
        a: "Aim for 50–60 characters. Google's display window in desktop SERPs is roughly 580 pixels — which works out to ~60 chars in the average font, but a few wide letters (W, M, capital letters) eat the budget faster.",
      },
      {
        q: "Why does Google rewrite my title?",
        a: "About 60% of titles get rewritten. Causes: stuffing the same keyword multiple times, including the brand twice, exceeding 60 chars, or using a title that doesn't match the page content. Match what the page is actually about and you'll get rewritten less often.",
      },
      {
        q: "Can I have the same title on multiple pages?",
        a: "Technically yes, but it's a waste — Google will only rank one of them and may treat the others as low-quality. Always per-page unique.",
      },
    ],
  },
  {
    slug: "robots-txt-validator",
    toolId: "robots-txt",
    shortName: "Robots.txt Validator",
    longName: "Free Robots.txt Validator",
    oneLiner:
      "Fetch your live robots.txt, check it doesn't accidentally block all crawlers, and verify it points at your sitemap.",
    ctaCopy: "Validate robots.txt",
    why:
      "robots.txt is the first file Google fetches from your domain — before any HTML. A wrong line can deindex your entire site overnight. The most common, most expensive mistake is shipping `Disallow: /` from a staging environment to production. Second most common: not pointing crawlers at your sitemap, which delays indexing of new pages by weeks.",
    goodPattern: [
      "Lives at /robots.txt (not /robots/, not /robot.txt)",
      "Has a `User-agent: *` block",
      "References your sitemap with `Sitemap: https://yourdomain.com/sitemap.xml`",
      "Returns HTTP 200 (not 404, not redirected)",
    ],
    badPattern: [
      "`Disallow: /` (blocks every crawler from every page)",
      "Returns 404 (no robots.txt at all)",
      "Returns 500 or times out",
      "Blocks /css/ or /js/ (Google needs to render the page)",
    ],
    fix: [
      "Create a plaintext file at `/robots.txt`.",
      "Add `User-agent: *\\nAllow: /` as the minimum allow-everything baseline.",
      "Add a `Sitemap: https://yourdomain.com/sitemap.xml` line.",
      "Confirm the file returns HTTP 200, not a redirect.",
    ],
    faq: [
      {
        q: "Do I need a robots.txt?",
        a: "Technically no — without one, Google assumes everything is crawlable. But it's the only place to point Google at your sitemap, and it lets you block bot-spam paths (?utm_*, /cart, /search). Always have one.",
      },
      {
        q: "Will robots.txt fix my deindexing problem?",
        a: "If your site disappeared from Google, check robots.txt first. A `Disallow: /` shipped from staging is the #1 cause of mass deindexing in WordPress + custom CMS setups.",
      },
      {
        q: "Should I block AI crawlers (GPTBot, ClaudeBot)?",
        a: "Up to you. Blocking them prevents your content from being used to train models, but doesn't affect Google rankings. The default Sitebeat opinion: leave them allowed unless you have a content-licensing strategy.",
      },
    ],
  },
  {
    slug: "sitemap-validator",
    toolId: "sitemap",
    shortName: "Sitemap Validator",
    longName: "Free XML Sitemap Validator",
    oneLiner:
      "Fetch your /sitemap.xml, check it's valid XML, and count the URLs Google can see. Detects empty sitemaps and missing files.",
    ctaCopy: "Validate sitemap",
    why:
      "A sitemap.xml is how Google discovers pages on large or dynamic sites. Without one, new pages can take weeks to be crawled. With a broken one, none of them are. The most common failure mode isn't a missing sitemap — it's a sitemap that exists but contains zero URLs because the generator is broken or referencing the wrong content type.",
    goodPattern: [
      "Lives at /sitemap.xml",
      "Returns HTTP 200 with `Content-Type: application/xml`",
      "Contains <loc> entries for every important page",
      "Updated when new pages are published (most CMSes do this automatically)",
    ],
    badPattern: [
      "404 — no sitemap at all",
      "200 but zero <loc> entries",
      "URLs in the sitemap that 404 (broken pages)",
      "URLs blocked by robots.txt (contradiction Google penalizes)",
    ],
    fix: [
      "WordPress: install Yoast or RankMath — they auto-generate /sitemap.xml.",
      "Next.js: create `app/sitemap.ts` exporting a list of URL objects.",
      "Static sites: run a build-time script that walks your pages directory.",
      "Submit the sitemap URL in Google Search Console once it's live.",
    ],
    faq: [
      {
        q: "Do I need a sitemap if my site is small?",
        a: "If you have under 50 pages and they're all linked from your homepage, Google will find them without one. Above 50 pages, or if any are reachable only via internal search, a sitemap is required for full indexing.",
      },
      {
        q: "How many URLs can a sitemap have?",
        a: "50,000 URLs or 50MB uncompressed per sitemap file. Above that, use a sitemap index that points to multiple child sitemaps.",
      },
      {
        q: "Should I include image and video URLs?",
        a: "Yes — `<image:image>` and `<video:video>` extensions help Google index media that would otherwise be missed (lazy-loaded images, JS-mounted video players).",
      },
    ],
  },
  {
    slug: "schema-markup-tester",
    toolId: "schema-markup",
    shortName: "Schema Markup Tester",
    longName: "Free Schema Markup (JSON-LD) Tester",
    oneLiner:
      "Detect JSON-LD structured data on any page, list the schema types present, and flag pages with no structured data at all.",
    ctaCopy: "Test schema",
    why:
      "Schema markup (JSON-LD) is what lets your pages show up as rich results in Google — FAQ accordions, recipe cards, review stars, breadcrumbs, sitelinks. Pages without schema get a plain blue link; pages with it get visually-rich entries that double or triple click-through rate. It's the most under-deployed SEO win in 2026 because most sites still don't have it.",
    goodPattern: [
      "At least one `<script type=\"application/ld+json\">` block",
      "Valid JSON (parses cleanly)",
      "Includes Organization, WebSite, and a page-type schema (Article, Product, etc.)",
      "Validates in Google's Rich Results Test",
    ],
    badPattern: [
      "No JSON-LD at all (most common)",
      "JSON-LD present but malformed (typos break the entire block)",
      "Schema that doesn't match the page (Article schema on a product page)",
      "Microdata or RDFa instead of JSON-LD (works but harder to maintain)",
    ],
    fix: [
      "Decide what type of page this is: Article, Product, LocalBusiness, FAQ, etc.",
      "Generate JSON-LD via schema.org's documentation or a generator.",
      "Add it inside `<script type=\"application/ld+json\">` in the <head>.",
      "Test it in Google's Rich Results Test before deploying.",
    ],
    faq: [
      {
        q: "What schema types matter most?",
        a: "Organization (every site), WebSite + SearchAction (sitelinks searchbox), Article or BlogPosting (every content page), Product + Offer + AggregateRating (every product page), FAQPage (any page with Q&A), LocalBusiness (any local-service site).",
      },
      {
        q: "Does schema markup boost rankings?",
        a: "Not directly. But the rich results it unlocks dramatically increase click-through rate, and CTR feeds back into ranking quality signals. Sites that adopt schema typically see 20–80% more clicks for the same ranking position.",
      },
      {
        q: "Will Google penalize bad schema?",
        a: "Yes if it's deceptive — e.g., AggregateRating schema on a page with no real reviews. Google has manual actions for this. Stick to honest schema for content that exists on the page.",
      },
    ],
  },
];

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
