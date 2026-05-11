/**
 * Programmatic SEO page generation — N verticals × M cities pattern.
 *
 * Generates landing pages for two URL shapes:
 *
 *   /seo/<vertical>             — one page per vertical
 *   /seo/<city>/<vertical>      — one page per (city, vertical) combo
 *
 * For a merchant covering 19 verticals × 30 cities, this yields
 * 19 + 19×30 = 589 pages. All ship in the sitemap, all include JSON-LD,
 * all have no-store cache headers so the operator can update copy
 * without a deploy.
 *
 * Customize VERTICALS + CITIES per merchant. The example here mirrors
 * the SiteGrid catalog as a starting point.
 */

export interface Vertical {
  slug: string; // URL-safe key
  label: string; // human-readable, plural ("Dentists")
  singularLabel: string; // "Dentist"
  category: string; // grouping ("healthcare", "fitness", "trades", ...)
  promptHint?: string; // extra context for LLM-personalized variants
}

export interface City {
  slug: string;
  label: string; // "New York, NY"
  region?: string; // "northeast", "south", etc — optional grouping
}

/**
 * Default vertical list. Override per merchant by passing a custom list
 * to the page-render functions. The categories cover the common SMB
 * service-business universe; extend/prune as needed.
 */
export const DEFAULT_VERTICALS: Vertical[] = [
  // Healthcare
  { slug: "dentists", label: "Dentists", singularLabel: "Dentist", category: "healthcare" },
  { slug: "chiropractors", label: "Chiropractors", singularLabel: "Chiropractor", category: "healthcare" },
  { slug: "doctors", label: "Doctors", singularLabel: "Doctor", category: "healthcare" },
  // Fitness
  { slug: "gyms", label: "Gyms", singularLabel: "Gym", category: "fitness" },
  { slug: "yoga-studios", label: "Yoga Studios", singularLabel: "Yoga Studio", category: "fitness" },
  { slug: "pilates-studios", label: "Pilates Studios", singularLabel: "Pilates Studio", category: "fitness" },
  { slug: "crossfit-gyms", label: "CrossFit Boxes", singularLabel: "CrossFit Box", category: "fitness" },
  // Beauty & spa
  { slug: "salons", label: "Hair Salons", singularLabel: "Hair Salon", category: "beauty" },
  { slug: "spas", label: "Day Spas", singularLabel: "Day Spa", category: "beauty" },
  // Professional services
  { slug: "law-firms", label: "Law Firms", singularLabel: "Law Firm", category: "professional" },
  { slug: "cpas", label: "CPAs", singularLabel: "CPA", category: "professional" },
  // Trades
  { slug: "plumbers", label: "Plumbers", singularLabel: "Plumber", category: "trades" },
  { slug: "electricians", label: "Electricians", singularLabel: "Electrician", category: "trades" },
  // Food & retail
  { slug: "restaurants", label: "Restaurants", singularLabel: "Restaurant", category: "restaurants" },
  { slug: "boutiques", label: "Boutiques", singularLabel: "Boutique", category: "retail" },
  // Auto
  { slug: "auto-repair", label: "Auto Repair Shops", singularLabel: "Auto Repair Shop", category: "auto" },
  // Real estate
  { slug: "realtors", label: "Realtors", singularLabel: "Realtor", category: "real-estate" },
  // Pets
  { slug: "groomers", label: "Pet Groomers", singularLabel: "Pet Groomer", category: "pets" },
  // Generic
  { slug: "service-businesses", label: "Service Businesses", singularLabel: "Service Business", category: "general" },
];

/**
 * Default city list — 30 most populous US metros. Override per merchant
 * (a merchant only operating in California will pass a CA-only list).
 */
export const DEFAULT_CITIES: City[] = [
  { slug: "new-york-ny", label: "New York, NY", region: "northeast" },
  { slug: "los-angeles-ca", label: "Los Angeles, CA", region: "west" },
  { slug: "chicago-il", label: "Chicago, IL", region: "midwest" },
  { slug: "houston-tx", label: "Houston, TX", region: "south" },
  { slug: "phoenix-az", label: "Phoenix, AZ", region: "west" },
  { slug: "philadelphia-pa", label: "Philadelphia, PA", region: "northeast" },
  { slug: "san-antonio-tx", label: "San Antonio, TX", region: "south" },
  { slug: "san-diego-ca", label: "San Diego, CA", region: "west" },
  { slug: "dallas-tx", label: "Dallas, TX", region: "south" },
  { slug: "san-jose-ca", label: "San Jose, CA", region: "west" },
  { slug: "austin-tx", label: "Austin, TX", region: "south" },
  { slug: "jacksonville-fl", label: "Jacksonville, FL", region: "south" },
  { slug: "fort-worth-tx", label: "Fort Worth, TX", region: "south" },
  { slug: "columbus-oh", label: "Columbus, OH", region: "midwest" },
  { slug: "charlotte-nc", label: "Charlotte, NC", region: "south" },
  { slug: "san-francisco-ca", label: "San Francisco, CA", region: "west" },
  { slug: "indianapolis-in", label: "Indianapolis, IN", region: "midwest" },
  { slug: "seattle-wa", label: "Seattle, WA", region: "west" },
  { slug: "denver-co", label: "Denver, CO", region: "west" },
  { slug: "washington-dc", label: "Washington, DC", region: "northeast" },
  { slug: "boston-ma", label: "Boston, MA", region: "northeast" },
  { slug: "el-paso-tx", label: "El Paso, TX", region: "south" },
  { slug: "nashville-tn", label: "Nashville, TN", region: "south" },
  { slug: "detroit-mi", label: "Detroit, MI", region: "midwest" },
  { slug: "oklahoma-city-ok", label: "Oklahoma City, OK", region: "south" },
  { slug: "portland-or", label: "Portland, OR", region: "west" },
  { slug: "las-vegas-nv", label: "Las Vegas, NV", region: "west" },
  { slug: "memphis-tn", label: "Memphis, TN", region: "south" },
  { slug: "louisville-ky", label: "Louisville, KY", region: "south" },
  { slug: "baltimore-md", label: "Baltimore, MD", region: "northeast" },
];

export interface ProgrammaticSeoConfig {
  appUrl: string;
  brandName: string;
  productNoun: string; // "website", "preview", "mockup"
  priceLabel: string;  // "$199 once", "$49/month"
  verticals?: Vertical[];
  cities?: City[];
}

export interface SeoPage {
  url: string;
  path: string; // relative path with leading slash
  title: string;
  description: string;
  h1: string;
  body: string;
  jsonLd: Record<string, unknown>;
}

export function generateVerticalPages(config: ProgrammaticSeoConfig): SeoPage[] {
  const verticals = config.verticals ?? DEFAULT_VERTICALS;
  return verticals.map((v) => buildVerticalPage(v, config));
}

export function generateCityVerticalPages(config: ProgrammaticSeoConfig): SeoPage[] {
  const verticals = config.verticals ?? DEFAULT_VERTICALS;
  const cities = config.cities ?? DEFAULT_CITIES;
  const pages: SeoPage[] = [];
  for (const c of cities) {
    for (const v of verticals) {
      pages.push(buildCityVerticalPage(c, v, config));
    }
  }
  return pages;
}

export function generateAllSeoPages(config: ProgrammaticSeoConfig): SeoPage[] {
  return [...generateVerticalPages(config), ...generateCityVerticalPages(config)];
}

function buildVerticalPage(v: Vertical, config: ProgrammaticSeoConfig): SeoPage {
  const path = `/seo/website-for/${v.slug}`;
  const url = `${stripTrail(config.appUrl)}${path}`;
  const title = `${config.productNoun}s for ${v.label} — ${config.priceLabel}`;
  const description = `${config.brandName} builds ${config.productNoun}s for ${v.label.toLowerCase()} for ${config.priceLabel.toLowerCase()}. Live in 24 hours.`;
  const h1 = `${config.productNoun}s for ${v.label.toLowerCase()}`;
  return {
    url,
    path,
    title,
    description,
    h1,
    body: vertBodyTemplate(v, config),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: title,
      provider: { "@type": "Organization", name: config.brandName, url: config.appUrl },
      areaServed: "United States",
      serviceType: `${config.productNoun} for ${v.singularLabel.toLowerCase()}`,
      offers: { "@type": "Offer", price: stripPriceCents(config.priceLabel) },
    },
  };
}

function buildCityVerticalPage(
  c: City,
  v: Vertical,
  config: ProgrammaticSeoConfig,
): SeoPage {
  const path = `/seo/${c.slug}/${v.slug}-website`;
  const url = `${stripTrail(config.appUrl)}${path}`;
  const title = `${v.label} ${config.productNoun}s in ${c.label} — ${config.priceLabel}`;
  const description = `${config.brandName} builds ${config.productNoun}s for ${v.label.toLowerCase()} in ${c.label}. Live in 24 hours.`;
  const h1 = `${v.label} ${config.productNoun}s in ${c.label}`;
  return {
    url,
    path,
    title,
    description,
    h1,
    body: cityVertBodyTemplate(c, v, config),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: title,
      provider: { "@type": "Organization", name: config.brandName, url: config.appUrl },
      areaServed: { "@type": "City", name: c.label.split(",")[0]?.trim() ?? c.label },
      serviceType: `${config.productNoun} for ${v.singularLabel.toLowerCase()}`,
      offers: { "@type": "Offer", price: stripPriceCents(config.priceLabel) },
    },
  };
}

function vertBodyTemplate(v: Vertical, config: ProgrammaticSeoConfig): string {
  return `We build ${config.productNoun}s tailored to ${v.label.toLowerCase()}. Real photos from your business profile, the right copy for your industry, ready in 24 hours, no monthly subscription. ${config.priceLabel}. Click to see how it works.`;
}

function cityVertBodyTemplate(
  c: City,
  v: Vertical,
  config: ProgrammaticSeoConfig,
): string {
  return `${config.brandName} builds ${config.productNoun}s for ${v.label.toLowerCase()} in ${c.label} — pulled from your real Google Business Profile, ready in 24 hours, no monthly subscription. ${config.priceLabel}.`;
}

function stripTrail(s: string): string {
  return s.replace(/\/$/, "");
}

function stripPriceCents(label: string): string {
  const m = label.match(/\$([0-9]+(?:\.[0-9]+)?)/);
  return m?.[1] ?? "0";
}

/**
 * Build sitemap-ready URLs for every programmatic page. Wire into the
 * merchant's app/sitemap.ts to ship them all.
 */
export function sitemapEntries(config: ProgrammaticSeoConfig): Array<{
  url: string;
  changefreq: string;
  priority: number;
}> {
  return generateAllSeoPages(config).map((p) => ({
    url: p.url,
    changefreq: "weekly",
    priority: 0.5,
  }));
}
