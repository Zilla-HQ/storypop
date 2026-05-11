/**
 * Platform-specific SEO landing pages. Programmatic SEO targeting
 * "SEO for Shopify", "SEO for WordPress", etc. — high-intent keyword
 * cluster that compound-converts because users searching are already
 * platform-aware.
 *
 * Routes: /seo-for/platform/[slug]
 */

export interface PlatformDef {
  slug: string;
  // For meta titles, breadcrumbs:
  name: string;
  // The first sentence of the lede:
  positioning: string;
  // Per-platform issues we routinely find on sites built on this stack:
  topIssues: string[];
  // Quick wins specific to this platform:
  quickWins: string[];
  // FAQ items:
  faq: { q: string; a: string }[];
}

export const PLATFORMS: PlatformDef[] = [
  {
    slug: "shopify",
    name: "Shopify",
    positioning:
      "Shopify ships better SEO defaults than most platforms — but the moment you install a 3rd-party theme or app, things break. Most Shopify SEO problems are theme + app problems.",
    topIssues: [
      "Theme-injected duplicate meta tags (theme + Shopify default both inject)",
      "Product variants creating dozens of near-duplicate URLs",
      "Apps adding /pages/ URLs without proper canonical setup",
      "Slow Liquid templates with 5MB hero videos on collection pages",
      "Missing Product + Offer schema on PDPs (or schema with stale pricing)",
    ],
    quickWins: [
      "Audit Shopify theme + app meta tag injection — keep one source of truth",
      "Set canonical tags on variant URLs to the parent product URL",
      "Use Shopify's built-in image transforms (`{{ image | image_url: width: 800 }}`) — auto-generates WebP",
      "Install JSON-LD Manager or use Shopify's built-in Product schema, not both",
      "Run a weekly audit — Shopify app updates break SEO more often than theme updates",
    ],
    faq: [
      {
        q: "Is Shopify good for SEO?",
        a: "Out of the box, Shopify is one of the better-defaulted platforms — proper canonicals, sitemap, robots, fast hosting. The problems start when you install themes and apps that fight Shopify's defaults.",
      },
      {
        q: "Does Sitebeat work with Shopify?",
        a: "Yes — Sitebeat audits Shopify storefronts the same way it audits any URL. We don't need API access, just your store's public URL.",
      },
      {
        q: "What's the #1 Shopify SEO mistake?",
        a: "Installing 3+ schema apps that all inject Product schema simultaneously. Google sees conflicting markup, ignores all of it, and you lose rich-result eligibility. Use one schema source.",
      },
    ],
  },
  {
    slug: "wordpress",
    name: "WordPress",
    positioning:
      "WordPress runs ~43% of the web. It has the largest SEO surface area and the most ways to break SEO of any platform. Most WordPress SEO problems are plugin or theme problems.",
    topIssues: [
      "Yoast + RankMath + AIOSEO all installed simultaneously (one wins arbitrarily, others inject conflicting metadata)",
      "WP Rocket / LiteSpeed Cache breaking dynamic canonicals during cache builds",
      "Theme injecting `<meta name='robots' content='noindex'>` after a staging deploy",
      "Permalinks set to `?p=123` instead of `/post-name/` — kills keyword-in-URL signal",
      "Plugin-induced duplicate sitemaps (two plugins both expose /sitemap.xml)",
    ],
    quickWins: [
      "Pick one SEO plugin (Yoast OR RankMath OR AIOSEO) — never all three",
      "Switch permalinks to `/post-name/` if not already",
      "Audit `wp-config.php` for `WP_DEBUG` / staging URLs in production",
      "Disable XML-RPC if unused — it's a security + crawl burden",
      "Run weekly audits — WP plugin updates regress SEO more often than core",
    ],
    faq: [
      {
        q: "Is WordPress good for SEO?",
        a: "WordPress + a single SEO plugin (Yoast or RankMath) is excellent. WordPress with conflicting plugins, slow hosting, and no caching is terrible. The platform itself is neutral — your stack matters.",
      },
      {
        q: "Should I use Yoast, RankMath, or AIOSEO?",
        a: "Any single one is fine. RankMath is the most full-featured free tier. Yoast is the most established. AIOSEO is the most beginner-friendly. Pick one, never run two.",
      },
      {
        q: "Does Sitebeat have a WordPress plugin?",
        a: "Yes — install our free plugin from the WordPress.org repository to run audits directly from your WP admin dashboard.",
      },
    ],
  },
  {
    slug: "webflow",
    name: "Webflow",
    positioning:
      "Webflow gives you total control over markup, which is great for SEO power users and disastrous for novices. The markup is whatever the designer made it — including all the SEO mistakes baked in at design time.",
    topIssues: [
      "Designers using H2s as visual styling instead of semantic structure",
      "Missing meta descriptions on CMS-generated pages",
      "Lottie animations that wreck Core Web Vitals",
      "Webflow's image optimization left at default (no WebP, no compression)",
      "CMS pages with no schema markup (Webflow doesn't auto-generate)",
    ],
    quickWins: [
      "Audit page settings → SEO tab on every CMS template — meta description must be set per-template",
      "Use Webflow's Image Optimization toggle — it's off by default on older sites",
      "Add JSON-LD via custom code embed on every CMS template",
      "Set canonical tag in Page Settings → Custom Code per template",
      "Use Webflow's built-in sitemap; don't ship a custom one alongside",
    ],
    faq: [
      {
        q: "Is Webflow good for SEO?",
        a: "It can be excellent — you have total control. But that control is wasted on most teams who treat Webflow as a no-code design tool and don't configure SEO settings per-template.",
      },
      {
        q: "Why is Webflow page speed slow?",
        a: "Webflow's hosted plan ships unoptimized assets unless you toggle Image Optimization on. Most sites we audit have this off. Toggling it on typically halves page weight.",
      },
      {
        q: "Can Sitebeat audit Webflow sites?",
        a: "Yes — Sitebeat audits any public URL.",
      },
    ],
  },
  {
    slug: "squarespace",
    name: "Squarespace",
    positioning:
      "Squarespace prioritizes design over technical control. SEO is decent out of the box but capped — you can't customize as deeply as Webflow or WordPress.",
    topIssues: [
      "Templates that auto-inject H1 from the page title (so every page has the same H1)",
      "Image filenames not customized — alt text inherits filename gibberish",
      "Site title appended to every page title (truncating real keywords)",
      "Heavy hero images with no WebP fallback",
      "Limited canonical control on parameterized URLs",
    ],
    quickWins: [
      "Edit site title to be short — it eats your per-page title budget",
      "Set image titles + alt text on every uploaded image (Squarespace defaults are useless)",
      "Use the Page Settings → SEO tab on every page (default meta descriptions are bad)",
      "Disable AMP if you have it on (deprecated as a ranking factor)",
      "Avoid overusing index pages — they confuse canonical signals",
    ],
    faq: [
      {
        q: "Is Squarespace good for SEO?",
        a: "It's adequate — the defaults aren't terrible but you'll hit ceilings on technical SEO faster than with Webflow or WordPress. Best for content-light sites that prioritize design.",
      },
      {
        q: "Can I add schema markup on Squarespace?",
        a: "Yes, via Code Injection (Premium plans only) — paste JSON-LD into the per-page Header injection field.",
      },
      {
        q: "Should I migrate off Squarespace for SEO?",
        a: "Only if you're hitting clear ceilings (no canonical control, can't customize sitemap). Otherwise a Squarespace site with attention to per-page SEO settings ranks fine.",
      },
    ],
  },
  {
    slug: "wix",
    name: "Wix",
    positioning:
      "Wix's SEO has improved dramatically since 2020 — the legacy reputation is partly outdated. But it still ships less-favorable defaults than competitors, and template-builders rarely change them.",
    topIssues: [
      "Wix Velo widgets blocking initial render with client-side data fetches",
      "Default meta descriptions repeated across pages",
      "Heavy Wix Editor-generated CSS bloating page weight",
      "Wix Stores generating dynamic URLs that proliferate",
      "Old Wix sites still on the legacy Flash-based architecture (rare but exists)",
    ],
    quickWins: [
      "Migrate to Wix Studio if you're on legacy Wix — better SEO defaults",
      "Set per-page SEO settings (title + description) on every page",
      "Compress images before upload — Wix's image optimizer is conservative",
      "Disable any unused Velo widgets",
      "Audit weekly — Wix app marketplace plugins regress SEO often",
    ],
    faq: [
      {
        q: "Is Wix bad for SEO?",
        a: "No — that's a legacy reputation. Modern Wix (especially Wix Studio) is competitive. The problem is most Wix sites are built by non-SEOs using templates that don't customize per-page SEO settings.",
      },
      {
        q: "Should I move off Wix for SEO?",
        a: "Only if you're on legacy Wix (pre-2020 templates) — the architecture changes there matter. Modern Wix is fine for most use cases.",
      },
      {
        q: "Does Sitebeat work with Wix?",
        a: "Yes — Sitebeat audits the live published Wix URL.",
      },
    ],
  },
  {
    slug: "ghost",
    name: "Ghost",
    positioning:
      "Ghost ships the cleanest SEO defaults of any CMS. Headless-style markup, automatic structured data, fast hosting. Most Ghost SEO problems aren't Ghost — they're how the operator uses it.",
    topIssues: [
      "Default theme injecting brand into every page title",
      "Tag pages indexing instead of being marked noindex (creates thin-content duplicates)",
      "Missing meta description on author / tag archive pages",
      "Open Graph image not set per-post (defaults to a generic share image)",
      "Author-bio pages with thin content getting indexed",
    ],
    quickWins: [
      "Use Ghost's per-post meta description field — don't rely on auto-generation",
      "Set per-post OG image; default fallback is bad for social shares",
      "Configure noindex on tag and author archive pages if they're thin",
      "Use Ghost's built-in JSON-LD — already correct, just don't break it with custom themes",
      "Self-host on Bunny / DigitalOcean for sub-100ms TTFB if speed is critical",
    ],
    faq: [
      {
        q: "Is Ghost good for SEO?",
        a: "Ghost has the best SEO defaults of any CMS we audit. The architecture, structured data, and performance are all dialed in. You can still break it, but it's harder than with WordPress.",
      },
      {
        q: "Should I switch from WordPress to Ghost for SEO?",
        a: "If your site is content-only (no e-commerce, no membership beyond Ghost's own), and you value speed + simplicity, yes. Ghost ranks fine. Don't switch if you depend on WordPress plugins that don't have Ghost equivalents.",
      },
      {
        q: "Does Sitebeat support Ghost?",
        a: "Yes — Sitebeat audits any published URL, regardless of platform.",
      },
    ],
  },
];

export function getPlatform(slug: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.slug === slug);
}
