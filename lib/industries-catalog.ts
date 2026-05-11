/**
 * Industry × city landing pages. Programmatic SEO surface targeting
 * local SMB intent ("seo for plumbers in austin"). Each combination
 * generates a static page at `/seo-for/[industry]/[city]`.
 *
 * Keep both lists modest — Google penalizes large amounts of nearly
 * identical doorway pages. We start with high-intent industries × the
 * top US/UK metros and expand based on what actually ranks.
 */

export interface IndustryDef {
  slug: string;
  // Plural noun we'll use throughout copy ("plumbers", "dentists"):
  noun: string;
  nounSingular: string;
  // Industry-specific SEO observations — what we routinely see broken
  // when we audit sites in this vertical. Keep specific and useful.
  topIssues: string[];
  // Verticals that share a sensible intent — we'll cross-link them.
  related: string[];
}

export interface CityDef {
  slug: string;
  name: string; // "Austin"
  region: string; // "TX" or "London"
}

export const INDUSTRIES: IndustryDef[] = [
  {
    slug: "plumbers",
    noun: "plumbers",
    nounSingular: "plumber",
    topIssues: [
      "Missing or generic meta descriptions on every service page",
      "No LocalBusiness schema markup (kills rich-result eligibility)",
      "Page speed slower than 4 seconds — Wix and Duda templates are common offenders",
      "Sitemap missing or incomplete (often only includes the homepage)",
      "Service pages use the same H1 as the homepage instead of unique keyword H1s",
    ],
    related: ["hvac", "electricians", "roofers"],
  },
  {
    slug: "dentists",
    noun: "dentists",
    nounSingular: "dentist",
    topIssues: [
      "Generic meta descriptions ('Welcome to our practice') instead of service-specific",
      "Missing schema for Dentist + LocalBusiness (Google rewards both)",
      "Heavy hero images that wreck Core Web Vitals scores",
      "No internal linking between service pages and the homepage",
      "Inconsistent NAP (name/address/phone) across pages — bad for local SEO",
    ],
    related: ["chiropractors", "orthodontists", "medical-practices"],
  },
  {
    slug: "lawyers",
    noun: "lawyers",
    nounSingular: "lawyer",
    topIssues: [
      "Practice-area pages with thin content (under 300 words)",
      "No FAQ schema on FAQ-heavy pages",
      "Bar association directory links not appearing (no local citations strategy)",
      "Bloated PDF case studies indexed instead of HTML pages",
      "No Attorney schema or LocalBusiness markup",
    ],
    related: ["accountants", "consultants"],
  },
  {
    slug: "hvac",
    noun: "HVAC contractors",
    nounSingular: "HVAC contractor",
    topIssues: [
      "Service-area pages copy-pasted across cities (duplicate content)",
      "Missing emergency-service schema markup",
      "No mobile viewport tag — phone visitors get desktop layouts",
      "Sitemap doesn't include service-area landing pages",
      "Page titles longer than 60 chars — truncated in mobile search",
    ],
    related: ["plumbers", "electricians", "roofers"],
  },
  {
    slug: "real-estate-agents",
    noun: "real estate agents",
    nounSingular: "real estate agent",
    topIssues: [
      "MLS-listing pages with thin/duplicate content (Google deindexes them)",
      "No agent profile schema (Person + RealEstateAgent)",
      "Page speed wrecked by IDX widgets and listing carousels",
      "No alt text on listing photos — invisible to image search",
      "Broken internal links to expired listings",
    ],
    related: ["mortgage-brokers", "home-builders"],
  },
  {
    slug: "restaurants",
    noun: "restaurants",
    nounSingular: "restaurant",
    topIssues: [
      "No Restaurant schema — kills rich result for menu pricing/hours",
      "Menu hidden behind PDF or image (uncrawlable)",
      "Missing OpenGraph tags — Instagram/FB shares look broken",
      "No structured data for opening hours",
      "Cookie-banner JavaScript blocking initial render",
    ],
    related: ["cafes", "bakeries", "food-trucks"],
  },
  {
    slug: "chiropractors",
    noun: "chiropractors",
    nounSingular: "chiropractor",
    topIssues: [
      "Service pages with stock photos and AI-generated text (Google's helpful-content filter penalizes)",
      "Missing MedicalBusiness or LocalBusiness schema",
      "No internal links between conditions-treated pages and book-an-appointment CTAs",
      "Page titles all start with the practice name (waste of the front)",
      "Robots.txt accidentally blocking /api/ booking endpoints",
    ],
    related: ["dentists", "physical-therapists"],
  },
  {
    slug: "electricians",
    noun: "electricians",
    nounSingular: "electrician",
    topIssues: [
      "Pages titled 'Services' or 'About Us' instead of keyword-led titles",
      "No emergency-call schema or 24/7 markers in markup",
      "Service-area pages all have identical content with city name swapped",
      "No mobile click-to-call link (huge mobile conversion loss)",
      "Missing LocalBusiness schema with geo coordinates",
    ],
    related: ["plumbers", "hvac", "roofers"],
  },
  {
    slug: "accountants",
    noun: "accountants",
    nounSingular: "accountant",
    topIssues: [
      "Service pages with thin generic content (under 200 words)",
      "No FAQPage schema on tax-FAQ-heavy pages",
      "Missing AccountingService LocalBusiness sub-type",
      "PDF tax guides indexed instead of HTML pages",
      "No internal linking between service pages and the homepage",
    ],
    related: ["lawyers", "consultants", "financial-advisors"],
  },
  {
    slug: "gyms",
    noun: "gyms",
    nounSingular: "gym",
    topIssues: [
      "Class schedule loaded by JavaScript (uncrawlable)",
      "No SportsActivityLocation or HealthClub schema",
      "Hero video kills page speed on mobile",
      "Missing OpenGraph image — Instagram shares look broken",
      "Sitemap doesn't include trainer profile pages",
    ],
    related: ["chiropractors", "physical-therapists"],
  },
  {
    slug: "salons",
    noun: "salons",
    nounSingular: "salon",
    topIssues: [
      "Service menu hidden behind PDF or image (uncrawlable)",
      "No HairSalon or BeautySalon schema",
      "Missing OpenGraph tags — social shares look broken",
      "Booking widget JavaScript blocks initial render",
      "No alt text on portfolio photos — invisible to image search",
    ],
    related: ["spas", "cafes"],
  },
  {
    slug: "roofers",
    noun: "roofers",
    nounSingular: "roofer",
    topIssues: [
      "Storm-damage landing pages with duplicate content across cities",
      "No emergency-roofing schema markup",
      "Missing 'after the storm' seasonal content",
      "Heavy hero photos kill Core Web Vitals scores",
      "No insurance-claim FAQ schema",
    ],
    related: ["hvac", "plumbers", "electricians"],
  },
  {
    slug: "consultants",
    noun: "consultants",
    nounSingular: "consultant",
    topIssues: [
      "About-Us-style homepage with no service-specific keywords",
      "No ProfessionalService or ProfessionalBusiness schema",
      "Case studies as PDF instead of HTML pages",
      "Missing internal linking between articles and service pages",
      "No author schema on blog posts (kills E-E-A-T signals)",
    ],
    related: ["lawyers", "accountants"],
  },
  {
    slug: "physical-therapists",
    noun: "physical therapists",
    nounSingular: "physical therapist",
    topIssues: [
      "Treatment pages with stock photos and AI-generated copy",
      "No MedicalBusiness or PhysicalTherapy schema",
      "Booking-widget blocks render time",
      "Missing patient-FAQ schema",
      "No internal links between condition pages and CTA",
    ],
    related: ["chiropractors", "gyms"],
  },
  {
    slug: "financial-advisors",
    noun: "financial advisors",
    nounSingular: "financial advisor",
    topIssues: [
      "Compliance disclosures bloating page weight (>5MB pages)",
      "No FinancialService or AccountingService schema",
      "Missing author/advisor schema on team-bio pages",
      "Form-12 PDFs indexed in place of HTML pages",
      "No FAQPage schema on FAQ-heavy pages",
    ],
    related: ["accountants", "consultants"],
  },
];

export const CITIES: CityDef[] = [
  { slug: "new-york", name: "New York", region: "NY" },
  { slug: "los-angeles", name: "Los Angeles", region: "CA" },
  { slug: "chicago", name: "Chicago", region: "IL" },
  { slug: "houston", name: "Houston", region: "TX" },
  { slug: "phoenix", name: "Phoenix", region: "AZ" },
  { slug: "philadelphia", name: "Philadelphia", region: "PA" },
  { slug: "san-antonio", name: "San Antonio", region: "TX" },
  { slug: "san-diego", name: "San Diego", region: "CA" },
  { slug: "dallas", name: "Dallas", region: "TX" },
  { slug: "austin", name: "Austin", region: "TX" },
  { slug: "san-jose", name: "San Jose", region: "CA" },
  { slug: "san-francisco", name: "San Francisco", region: "CA" },
  { slug: "seattle", name: "Seattle", region: "WA" },
  { slug: "denver", name: "Denver", region: "CO" },
  { slug: "boston", name: "Boston", region: "MA" },
  { slug: "miami", name: "Miami", region: "FL" },
  { slug: "atlanta", name: "Atlanta", region: "GA" },
  { slug: "minneapolis", name: "Minneapolis", region: "MN" },
  { slug: "portland", name: "Portland", region: "OR" },
  { slug: "nashville", name: "Nashville", region: "TN" },
  { slug: "charlotte", name: "Charlotte", region: "NC" },
  { slug: "orlando", name: "Orlando", region: "FL" },
  { slug: "tampa", name: "Tampa", region: "FL" },
  { slug: "raleigh", name: "Raleigh", region: "NC" },
  { slug: "indianapolis", name: "Indianapolis", region: "IN" },
  { slug: "columbus", name: "Columbus", region: "OH" },
  { slug: "pittsburgh", name: "Pittsburgh", region: "PA" },
  { slug: "kansas-city", name: "Kansas City", region: "MO" },
  { slug: "salt-lake-city", name: "Salt Lake City", region: "UT" },
  { slug: "milwaukee", name: "Milwaukee", region: "WI" },
];

export function getIndustry(slug: string): IndustryDef | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function getCity(slug: string): CityDef | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function allIndustryCityCombos(): { industry: string; city: string }[] {
  const out: { industry: string; city: string }[] = [];
  for (const i of INDUSTRIES) {
    for (const c of CITIES) {
      out.push({ industry: i.slug, city: c.slug });
    }
  }
  return out;
}
