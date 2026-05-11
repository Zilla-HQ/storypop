/**
 * Top US metros for programmatic SEO. Each entry powers landing pages at
 *   /virtual-staging/[city]
 *   /twilight-photos/[city]
 *   /pool-cost/[city]
 *   /solar-payback/[city]
 *   /curb-appeal/[city]
 *
 * Slug convention: lowercased "city-state" (e.g. "phoenix-az") so
 * disambiguating duplicate names (Portland-OR vs Portland-ME) and
 * matching how Realtor.com / Zillow segment city pages.
 *
 * Median prices are rough Zillow Home Value Index reads as of late 2025.
 * Pool/solar feasibility flags drive which homeowner-side templates we
 * pre-render — Anchorage doesn't need a /pool-cost page.
 */
export interface City {
  slug: string;
  name: string;
  state: string;
  stateCode: string;
  population: number;
  medianHomePriceK: number;
  /** Climate / pool ownership rate supports outdoor pool ads. */
  poolFeasible: boolean;
  /** Solar irradiance + utility rates support solar payback ads. */
  solarFeasible: boolean;
}

export const CITIES: City[] = [
  // ─── Sunbelt — best for pool + solar ────────────────────────────────
  { slug: "phoenix-az",      name: "Phoenix",      state: "Arizona",       stateCode: "AZ", population: 1650000, medianHomePriceK: 445, poolFeasible: true,  solarFeasible: true },
  { slug: "tucson-az",       name: "Tucson",       state: "Arizona",       stateCode: "AZ", population: 545000,  medianHomePriceK: 335, poolFeasible: true,  solarFeasible: true },
  { slug: "mesa-az",         name: "Mesa",         state: "Arizona",       stateCode: "AZ", population: 510000,  medianHomePriceK: 460, poolFeasible: true,  solarFeasible: true },
  { slug: "scottsdale-az",   name: "Scottsdale",   state: "Arizona",       stateCode: "AZ", population: 245000,  medianHomePriceK: 870, poolFeasible: true,  solarFeasible: true },
  { slug: "houston-tx",      name: "Houston",      state: "Texas",         stateCode: "TX", population: 2300000, medianHomePriceK: 270, poolFeasible: true,  solarFeasible: true },
  { slug: "dallas-tx",       name: "Dallas",       state: "Texas",         stateCode: "TX", population: 1300000, medianHomePriceK: 320, poolFeasible: true,  solarFeasible: true },
  { slug: "austin-tx",       name: "Austin",       state: "Texas",         stateCode: "TX", population: 980000,  medianHomePriceK: 545, poolFeasible: true,  solarFeasible: true },
  { slug: "san-antonio-tx",  name: "San Antonio",  state: "Texas",         stateCode: "TX", population: 1450000, medianHomePriceK: 245, poolFeasible: true,  solarFeasible: true },
  { slug: "fort-worth-tx",   name: "Fort Worth",   state: "Texas",         stateCode: "TX", population: 950000,  medianHomePriceK: 295, poolFeasible: true,  solarFeasible: true },
  { slug: "el-paso-tx",      name: "El Paso",      state: "Texas",         stateCode: "TX", population: 680000,  medianHomePriceK: 215, poolFeasible: true,  solarFeasible: true },
  { slug: "miami-fl",        name: "Miami",        state: "Florida",       stateCode: "FL", population: 470000,  medianHomePriceK: 605, poolFeasible: true,  solarFeasible: true },
  { slug: "tampa-fl",        name: "Tampa",        state: "Florida",       stateCode: "FL", population: 400000,  medianHomePriceK: 395, poolFeasible: true,  solarFeasible: true },
  { slug: "orlando-fl",      name: "Orlando",      state: "Florida",       stateCode: "FL", population: 320000,  medianHomePriceK: 385, poolFeasible: true,  solarFeasible: true },
  { slug: "jacksonville-fl", name: "Jacksonville", state: "Florida",       stateCode: "FL", population: 970000,  medianHomePriceK: 305, poolFeasible: true,  solarFeasible: true },
  { slug: "fort-lauderdale-fl", name: "Fort Lauderdale", state: "Florida", stateCode: "FL", population: 185000,  medianHomePriceK: 540, poolFeasible: true,  solarFeasible: true },
  { slug: "naples-fl",       name: "Naples",       state: "Florida",       stateCode: "FL", population: 22000,   medianHomePriceK: 815, poolFeasible: true,  solarFeasible: true },
  { slug: "san-diego-ca",    name: "San Diego",    state: "California",    stateCode: "CA", population: 1380000, medianHomePriceK: 945, poolFeasible: true,  solarFeasible: true },
  { slug: "los-angeles-ca",  name: "Los Angeles",  state: "California",    stateCode: "CA", population: 3900000, medianHomePriceK: 985, poolFeasible: true,  solarFeasible: true },
  { slug: "san-jose-ca",     name: "San Jose",     state: "California",    stateCode: "CA", population: 970000,  medianHomePriceK: 1450, poolFeasible: true, solarFeasible: true },
  { slug: "san-francisco-ca",name: "San Francisco",state: "California",    stateCode: "CA", population: 815000,  medianHomePriceK: 1310, poolFeasible: false,solarFeasible: true },
  { slug: "sacramento-ca",   name: "Sacramento",   state: "California",    stateCode: "CA", population: 525000,  medianHomePriceK: 495, poolFeasible: true,  solarFeasible: true },
  { slug: "fresno-ca",       name: "Fresno",       state: "California",    stateCode: "CA", population: 545000,  medianHomePriceK: 380, poolFeasible: true,  solarFeasible: true },
  { slug: "riverside-ca",    name: "Riverside",    state: "California",    stateCode: "CA", population: 320000,  medianHomePriceK: 575, poolFeasible: true,  solarFeasible: true },
  { slug: "bakersfield-ca",  name: "Bakersfield",  state: "California",    stateCode: "CA", population: 410000,  medianHomePriceK: 365, poolFeasible: true,  solarFeasible: true },
  { slug: "las-vegas-nv",    name: "Las Vegas",    state: "Nevada",        stateCode: "NV", population: 660000,  medianHomePriceK: 415, poolFeasible: true,  solarFeasible: true },
  { slug: "henderson-nv",    name: "Henderson",    state: "Nevada",        stateCode: "NV", population: 320000,  medianHomePriceK: 475, poolFeasible: true,  solarFeasible: true },
  { slug: "albuquerque-nm",  name: "Albuquerque",  state: "New Mexico",    stateCode: "NM", population: 565000,  medianHomePriceK: 325, poolFeasible: true,  solarFeasible: true },
  { slug: "honolulu-hi",     name: "Honolulu",     state: "Hawaii",        stateCode: "HI", population: 350000,  medianHomePriceK: 855, poolFeasible: true,  solarFeasible: true },
  { slug: "atlanta-ga",      name: "Atlanta",      state: "Georgia",       stateCode: "GA", population: 510000,  medianHomePriceK: 410, poolFeasible: true,  solarFeasible: true },
  { slug: "savannah-ga",     name: "Savannah",     state: "Georgia",       stateCode: "GA", population: 145000,  medianHomePriceK: 295, poolFeasible: true,  solarFeasible: true },
  { slug: "charlotte-nc",    name: "Charlotte",    state: "North Carolina",stateCode: "NC", population: 900000,  medianHomePriceK: 395, poolFeasible: true,  solarFeasible: true },
  { slug: "raleigh-nc",      name: "Raleigh",      state: "North Carolina",stateCode: "NC", population: 470000,  medianHomePriceK: 425, poolFeasible: true,  solarFeasible: true },
  { slug: "charleston-sc",   name: "Charleston",   state: "South Carolina",stateCode: "SC", population: 155000,  medianHomePriceK: 545, poolFeasible: true,  solarFeasible: true },
  { slug: "nashville-tn",    name: "Nashville",    state: "Tennessee",     stateCode: "TN", population: 690000,  medianHomePriceK: 445, poolFeasible: true,  solarFeasible: true },
  { slug: "memphis-tn",      name: "Memphis",      state: "Tennessee",     stateCode: "TN", population: 625000,  medianHomePriceK: 165, poolFeasible: true,  solarFeasible: true },
  { slug: "new-orleans-la",  name: "New Orleans",  state: "Louisiana",     stateCode: "LA", population: 380000,  medianHomePriceK: 285, poolFeasible: true,  solarFeasible: true },
  { slug: "oklahoma-city-ok",name: "Oklahoma City",state: "Oklahoma",      stateCode: "OK", population: 695000,  medianHomePriceK: 215, poolFeasible: true,  solarFeasible: true },
  { slug: "birmingham-al",   name: "Birmingham",   state: "Alabama",       stateCode: "AL", population: 200000,  medianHomePriceK: 175, poolFeasible: true,  solarFeasible: true },

  // ─── Mid-tier — solar good, pool varies ─────────────────────────────
  { slug: "denver-co",       name: "Denver",       state: "Colorado",      stateCode: "CO", population: 715000,  medianHomePriceK: 595, poolFeasible: false, solarFeasible: true },
  { slug: "colorado-springs-co", name: "Colorado Springs", state: "Colorado", stateCode: "CO", population: 480000, medianHomePriceK: 465, poolFeasible: false, solarFeasible: true },
  { slug: "salt-lake-city-ut",name:"Salt Lake City",state: "Utah",         stateCode: "UT", population: 200000,  medianHomePriceK: 555, poolFeasible: false, solarFeasible: true },
  { slug: "boise-id",        name: "Boise",        state: "Idaho",         stateCode: "ID", population: 235000,  medianHomePriceK: 485, poolFeasible: false, solarFeasible: true },
  { slug: "portland-or",     name: "Portland",     state: "Oregon",        stateCode: "OR", population: 650000,  medianHomePriceK: 545, poolFeasible: false, solarFeasible: true },
  { slug: "seattle-wa",      name: "Seattle",      state: "Washington",    stateCode: "WA", population: 745000,  medianHomePriceK: 845, poolFeasible: false, solarFeasible: true },
  { slug: "spokane-wa",      name: "Spokane",      state: "Washington",    stateCode: "WA", population: 230000,  medianHomePriceK: 395, poolFeasible: false, solarFeasible: true },
  { slug: "richmond-va",     name: "Richmond",     state: "Virginia",      stateCode: "VA", population: 230000,  medianHomePriceK: 325, poolFeasible: true,  solarFeasible: true },
  { slug: "virginia-beach-va",name:"Virginia Beach",state: "Virginia",     stateCode: "VA", population: 460000,  medianHomePriceK: 385, poolFeasible: true,  solarFeasible: true },
  { slug: "louisville-ky",   name: "Louisville",   state: "Kentucky",      stateCode: "KY", population: 625000,  medianHomePriceK: 245, poolFeasible: true,  solarFeasible: true },
  { slug: "indianapolis-in", name: "Indianapolis", state: "Indiana",       stateCode: "IN", population: 880000,  medianHomePriceK: 235, poolFeasible: true,  solarFeasible: true },
  { slug: "kansas-city-mo",  name: "Kansas City",  state: "Missouri",      stateCode: "MO", population: 510000,  medianHomePriceK: 245, poolFeasible: true,  solarFeasible: true },
  { slug: "st-louis-mo",     name: "St. Louis",    state: "Missouri",      stateCode: "MO", population: 295000,  medianHomePriceK: 195, poolFeasible: true,  solarFeasible: true },
  { slug: "columbus-oh",     name: "Columbus",     state: "Ohio",          stateCode: "OH", population: 905000,  medianHomePriceK: 245, poolFeasible: false, solarFeasible: true },
  { slug: "cincinnati-oh",   name: "Cincinnati",   state: "Ohio",          stateCode: "OH", population: 310000,  medianHomePriceK: 235, poolFeasible: false, solarFeasible: true },
  { slug: "cleveland-oh",    name: "Cleveland",    state: "Ohio",          stateCode: "OH", population: 370000,  medianHomePriceK: 115, poolFeasible: false, solarFeasible: true },
  { slug: "detroit-mi",      name: "Detroit",      state: "Michigan",      stateCode: "MI", population: 635000,  medianHomePriceK: 80,  poolFeasible: false, solarFeasible: true },
  { slug: "minneapolis-mn",  name: "Minneapolis",  state: "Minnesota",     stateCode: "MN", population: 430000,  medianHomePriceK: 335, poolFeasible: false, solarFeasible: true },
  { slug: "milwaukee-wi",    name: "Milwaukee",    state: "Wisconsin",     stateCode: "WI", population: 575000,  medianHomePriceK: 195, poolFeasible: false, solarFeasible: true },
  { slug: "chicago-il",      name: "Chicago",      state: "Illinois",      stateCode: "IL", population: 2700000, medianHomePriceK: 305, poolFeasible: false, solarFeasible: true },
  { slug: "philadelphia-pa", name: "Philadelphia", state: "Pennsylvania",  stateCode: "PA", population: 1580000, medianHomePriceK: 225, poolFeasible: false, solarFeasible: true },
  { slug: "pittsburgh-pa",   name: "Pittsburgh",   state: "Pennsylvania",  stateCode: "PA", population: 300000,  medianHomePriceK: 235, poolFeasible: false, solarFeasible: true },

  // ─── Northeast — high prices, low pool, solar moderate ──────────────
  { slug: "new-york-ny",     name: "New York",     state: "New York",      stateCode: "NY", population: 8260000, medianHomePriceK: 765, poolFeasible: false, solarFeasible: true },
  { slug: "buffalo-ny",      name: "Buffalo",      state: "New York",      stateCode: "NY", population: 275000,  medianHomePriceK: 215, poolFeasible: false, solarFeasible: true },
  { slug: "boston-ma",       name: "Boston",       state: "Massachusetts", stateCode: "MA", population: 655000,  medianHomePriceK: 815, poolFeasible: false, solarFeasible: true },
  { slug: "newark-nj",       name: "Newark",       state: "New Jersey",    stateCode: "NJ", population: 305000,  medianHomePriceK: 425, poolFeasible: false, solarFeasible: true },
  { slug: "jersey-city-nj",  name: "Jersey City",  state: "New Jersey",    stateCode: "NJ", population: 290000,  medianHomePriceK: 565, poolFeasible: false, solarFeasible: true },
  { slug: "washington-dc",   name: "Washington",   state: "District of Columbia", stateCode: "DC", population: 670000, medianHomePriceK: 615, poolFeasible: true, solarFeasible: true },
  { slug: "baltimore-md",    name: "Baltimore",    state: "Maryland",      stateCode: "MD", population: 565000,  medianHomePriceK: 195, poolFeasible: true,  solarFeasible: true },

  // ─── Other notable ──────────────────────────────────────────────────
  { slug: "anchorage-ak",    name: "Anchorage",    state: "Alaska",        stateCode: "AK", population: 290000,  medianHomePriceK: 385, poolFeasible: false, solarFeasible: false },
  { slug: "providence-ri",   name: "Providence",   state: "Rhode Island",  stateCode: "RI", population: 190000,  medianHomePriceK: 425, poolFeasible: false, solarFeasible: true },
  { slug: "des-moines-ia",   name: "Des Moines",   state: "Iowa",          stateCode: "IA", population: 215000,  medianHomePriceK: 215, poolFeasible: false, solarFeasible: true },
  { slug: "omaha-ne",        name: "Omaha",        state: "Nebraska",      stateCode: "NE", population: 485000,  medianHomePriceK: 265, poolFeasible: true,  solarFeasible: true },
  { slug: "wichita-ks",      name: "Wichita",      state: "Kansas",        stateCode: "KS", population: 395000,  medianHomePriceK: 175, poolFeasible: true,  solarFeasible: true },
  { slug: "little-rock-ar",  name: "Little Rock",  state: "Arkansas",      stateCode: "AR", population: 200000,  medianHomePriceK: 195, poolFeasible: true,  solarFeasible: true },
  { slug: "boulder-co",      name: "Boulder",      state: "Colorado",      stateCode: "CO", population: 105000,  medianHomePriceK: 805, poolFeasible: false, solarFeasible: true },
  { slug: "asheville-nc",    name: "Asheville",    state: "North Carolina",stateCode: "NC", population: 95000,   medianHomePriceK: 445, poolFeasible: false, solarFeasible: true },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/** Cities relevant to a given homeowner-side service (climate-filtered). */
export function citiesForService(serviceId: string): City[] {
  if (serviceId === "pool-mockup") return CITIES.filter((c) => c.poolFeasible);
  if (serviceId === "solar-mockup") return CITIES.filter((c) => c.solarFeasible);
  return CITIES;
}

// ============ Sitebeat-vertical compatibility aliases ============
// app/(marketing)/host/[city], grade/[city], manager, p/[handle], etc.
// (added in the Sitebeat backport — commits 055364a / a853742 / cc02c49)
// import CITY_TARGETS + findCity instead of CITIES + getCity. Re-export the
// same data under both naming conventions so neither vertical's pages need
// to be rewritten. The two extra fields (signal + marketNote) are
// vacation-rental-flavored copy that gets surfaced on /host + /grade pages
// — populated as empty strings here so a forked merchant can either fill
// them in (vacation-rental vertical) or ignore them (other verticals).

export type CityTarget = City & {
  /** Short market-condition hook displayed at top of host/grade pages. */
  signal?: string;
  /** One-line market summary displayed below the hook. */
  marketNote?: string;
};

export const CITY_TARGETS: CityTarget[] = CITIES.map((c) => ({
  ...c,
  signal: "",
  marketNote: "",
}));

export function findCity(slug: string): CityTarget | undefined {
  return CITY_TARGETS.find((c) => c.slug === slug);
}
