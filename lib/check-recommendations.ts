/**
 * Per-check fix instructions, keyed on `SeoCheck.id` from
 * lib/seo-checker.ts. Used in the audit results page (expandable rows)
 * and in the audit-report email so recipients see actionable next steps,
 * not just a list of failures.
 *
 * Only shown for `warn`/`fail` checks — passes don't need fixing.
 */

export interface CheckRecommendation {
  why: string;
  fix: string;
}

const RECOMMENDATIONS: Record<string, CheckRecommendation> = {
  https: {
    why: "Google demotes non-HTTPS sites in search results, and most browsers show a 'Not Secure' warning that scares away customers.",
    fix: "Get a free TLS certificate via Cloudflare or Let's Encrypt and force-redirect HTTP traffic to HTTPS at the origin / CDN.",
  },
  meta_description: {
    why: "The meta description is the gray text under your title in search results. Pages without one get an auto-generated snippet that rarely matches search intent — lower click-through rate.",
    fix: "Add a `<meta name=\"description\" content=\"...\">` tag in the `<head>` of every page, 120–160 characters, that summarizes what's on the page and includes your primary keyword.",
  },
  heading_structure: {
    why: "Crawlers parse your H1/H2/H3 hierarchy to understand what your page is about. A missing or duplicate H1 makes it hard for search engines to rank the page for any specific term.",
    fix: "Ensure exactly one `<h1>` per page, then use `<h2>` for major sections and `<h3>` for sub-sections. Don't skip levels (no `<h2>` directly inside `<h1>` without intervening structure).",
  },
  page_speed: {
    why: "Pages with TTFB above 600ms drop in mobile rankings (Google's Core Web Vitals). Above 2s, ~50% of visitors bounce before the page renders.",
    fix: "Move to a faster host or add a CDN (Cloudflare, Vercel, Bunny). Cache rendered HTML for static pages. Defer non-critical JavaScript with `<script defer>`.",
  },
  sitemap: {
    why: "A sitemap.xml tells search engines which pages exist on your site. Without one, large or dynamic sites end up with pages that never get indexed.",
    fix: "Generate an XML sitemap (Next.js: `app/sitemap.ts`; WordPress: Yoast/RankMath plugin; static sites: a build script). Place it at `/sitemap.xml` and reference it from `/robots.txt`.",
  },
  robots_txt: {
    why: "robots.txt tells crawlers which paths to index. A missing or malformed robots.txt can leave staging URLs indexed or important pages blocked.",
    fix: "Create a `/robots.txt` with `User-agent: *` and an `Allow: /` plus a `Sitemap:` line pointing to your sitemap.xml.",
  },
  canonical: {
    why: "Without a canonical tag, search engines can index multiple variants of the same page (with/without query params, http vs https, www vs apex) and split your ranking signals.",
    fix: "Add `<link rel=\"canonical\" href=\"<the-canonical-url>\">` in the `<head>` of every page, pointing to the version you want indexed.",
  },
  mobile_viewport: {
    why: "Without a viewport meta tag, mobile browsers render the desktop layout zoomed out — Google flags this as not mobile-friendly and downranks the page on mobile search.",
    fix: "Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` in the `<head>` of every page.",
  },
  lang_attribute: {
    why: "The `lang` attribute helps search engines serve your page to the right regional audience and helps screen readers pronounce content correctly.",
    fix: "Set the language attribute on the `<html>` root element: `<html lang=\"en\">` (or `en-US`, `es`, etc. as appropriate).",
  },
  image_alt: {
    why: "Alt text is what screen readers narrate AND how Google indexes images. Missing alt text means lost image-search traffic plus accessibility / ADA risk.",
    fix: "Add `alt=\"...\"` to every `<img>` tag describing what's in the image. For purely decorative images, use `alt=\"\"` (empty, but present).",
  },
  open_graph: {
    why: "Open Graph tags control how your page looks when shared on social media (LinkedIn, Twitter, iMessage, Slack). Without them, links show as raw URLs — no preview, way fewer clicks.",
    fix: "Add `<meta property=\"og:title\">`, `<meta property=\"og:description\">`, and `<meta property=\"og:image\">` to every page's `<head>`. Image should be 1200×630px.",
  },
  broken_links: {
    why: "Broken internal links hurt both user experience and crawl efficiency — Google wastes crawl budget on dead URLs instead of indexing your content.",
    fix: "Run a link checker (Screaming Frog, Ahrefs, or `npx broken-link-checker`) and either fix the broken URLs or 301-redirect them to the new location.",
  },
  structured_data: {
    why: "Schema.org markup (JSON-LD) unlocks rich results in Google — review stars, FAQ accordions, product carousels, etc. — which dramatically increase click-through rate.",
    fix: "Add `<script type=\"application/ld+json\">` blocks for the page's main entity. For restaurants: `Restaurant` schema with hours, address, menu. For SaaS: `SoftwareApplication`. Validate with Google's Rich Results Test.",
  },
  local_schema: {
    why: "Google's 'local pack' (the 3-result map block at the top of search results) only shows businesses with proper LocalBusiness schema. Without it, you're invisible to most 'near me' searches even if your site otherwise has good SEO.",
    fix: "Add a `<script type=\"application/ld+json\">` block with the most specific schema type that applies (Restaurant, Plumber, Dentist, AutoRepair, RealEstateAgent, etc.) including `name`, `address` (PostalAddress), `telephone`, `openingHoursSpecification`, and `priceRange`. Schema.org has the full list at https://schema.org/LocalBusiness#subtypes.",
  },
  nap_consistency: {
    why: "Search engines treat unmatched name/address/phone (NAP) as a trust failure — if your homepage doesn't say where you are, Google can't rank you for 'near me' searches and customers can't find you.",
    fix: "Add the full street address and phone number to your site footer. Use `<a href=\"tel:+15551234567\">` for clickable phone (mobile UX win + machine-readable). Use a JSON-LD `PostalAddress` block for the address. Make sure these match exactly what's on your Google Business Profile.",
  },
};

export function recommendationFor(checkId: string): CheckRecommendation | undefined {
  return RECOMMENDATIONS[checkId];
}
