/**
 * Blog post index. Single source of truth for the post listing, sitemap, and
 * cross-links between posts.
 *
 * Each entry has a corresponding `app/(marketing)/blog/[slug]/page.tsx` that
 * owns the article's metadata, hero, and body. We don't use MDX or a CMS for
 * v1 — straight tsx is the lowest-overhead path that still indexes cleanly.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** ISO date — used for sitemap.lastModified and the post header. */
  publishedAt: Date;
  /** Primary topic tag — drives related-post recs. */
  category: "ranking" | "photos" | "copy" | "policy" | "pricing";
  /** Reading-time estimate in minutes — surfaced in the listing card. */
  readingMinutes: number;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "why-isnt-my-airbnb-getting-bookings",
    title: "Why isn't my Airbnb getting bookings in 2026?",
    description:
      "The five most common reasons Airbnb listings stop converting — and what to fix in what order. Updated for 2026's algorithm and supply landscape.",
    publishedAt: new Date("2026-05-06"),
    category: "ranking",
    readingMinutes: 8,
  },
  {
    slug: "airbnb-search-ranking-factors",
    title: "Airbnb search ranking factors: what we know in 2026",
    description:
      "What Airbnb has actually said about ranking, what the data shows from 200k+ listings, and the 9 levers hosts can pull right now.",
    publishedAt: new Date("2026-05-06"),
    category: "ranking",
    readingMinutes: 10,
  },
  {
    slug: "airbnb-listing-photos-dos-and-donts",
    title: "Airbnb listing photos: the 2026 do's and don'ts",
    description:
      "Lighting, framing, photo count, ordering, and what Airbnb's TOS lets you edit (and what it doesn't). The single highest-leverage thing most hosts get wrong.",
    publishedAt: new Date("2026-05-06"),
    category: "photos",
    readingMinutes: 9,
  },
  {
    slug: "how-often-should-i-update-my-airbnb-listing",
    title: "How often should you update your Airbnb listing?",
    description:
      "Most hosts set their listing up once and never come back. Here's the cadence that actually correlates with consistent booking velocity.",
    publishedAt: new Date("2026-05-06"),
    category: "ranking",
    readingMinutes: 6,
  },
  {
    slug: "is-virtual-staging-allowed-on-airbnb",
    title: "Is virtual staging allowed on Airbnb?",
    description:
      "Airbnb's content policy on photo edits, in plain English. What's compliant (color, light, sky), what's not (added furniture), and what the gray areas are.",
    publishedAt: new Date("2026-05-06"),
    category: "policy",
    readingMinutes: 7,
  },
  {
    slug: "airbnb-title-formulas-by-market",
    title: "Airbnb title formulas that work in the top 25 STR markets",
    description:
      "The same generic title underperforms in every market. Specific signal hooks vary by city — pool in Phoenix, walkability in Savannah, ski-in/out in Park City. Here's what to lead with where.",
    publishedAt: new Date("2026-05-06"),
    category: "copy",
    readingMinutes: 11,
  },
  {
    slug: "airbnb-hero-photo-what-it-should-be",
    title: "Your Airbnb hero photo: what should it actually be?",
    description:
      "The single image Airbnb crops to the search-result tile is the strongest CTR lever you control. Most hosts pick wrong. Here's the rubric.",
    publishedAt: new Date("2026-05-06"),
    category: "photos",
    readingMinutes: 7,
  },
  {
    slug: "how-to-write-airbnb-description-that-converts",
    title: "How to write an Airbnb description that actually converts",
    description:
      "Most descriptions read like apology notes — pricing, amenity list, polite sign-off. The structure that converts: Hook, Proof, Call. With concrete examples.",
    publishedAt: new Date("2026-05-06"),
    category: "copy",
    readingMinutes: 9,
  },
  {
    slug: "30-day-pricing-strategy-new-hosts",
    title: "A 30-day pricing strategy for new Airbnb hosts",
    description:
      "If you've never run dynamic pricing, this is the path: anchor to the comp median, drop 15% for the first three reviews, then climb. No PriceLabs subscription required.",
    publishedAt: new Date("2026-05-06"),
    category: "pricing",
    readingMinutes: 8,
  },
  {
    slug: "cancel-rate-response-rate-algorithm",
    title: "Cancel rate, response rate, and the algorithm: an honest read",
    description:
      "Two of the few ranking inputs Airbnb tells you about explicitly. What the thresholds actually are, what they cost you when you cross them, and what to do about it.",
    publishedAt: new Date("2026-05-06"),
    category: "ranking",
    readingMinutes: 7,
  },
  {
    slug: "why-your-photos-look-phone-shot",
    title: "Why your photos look phone-shot (and how to fix it without a photographer)",
    description:
      "It's not the camera — it's the lighting, color, and composition. The fixes that turn phone-shot listings into magazine-grade ones, with no reshoot.",
    publishedAt: new Date("2026-05-06"),
    category: "photos",
    readingMinutes: 8,
  },
  {
    slug: "airbnb-instant-book-should-you-turn-it-on",
    title: "Airbnb Instant Book: should you turn it on?",
    description:
      "Instant Book is one of Airbnb's strongest ranking levers, but it has real trade-offs. The honest answer for hosts at three stages: brand-new, ramping, established.",
    publishedAt: new Date("2026-05-06"),
    category: "ranking",
    readingMinutes: 6,
  },
  {
    slug: "when-to-switch-from-airbnb-to-direct-booking",
    title: "When should you switch from Airbnb to direct booking?",
    description:
      "Direct booking saves you the 15% Airbnb fee, but it costs you Airbnb's distribution. The economic crossover point is later than most coaches claim.",
    publishedAt: new Date("2026-05-06"),
    category: "pricing",
    readingMinutes: 7,
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function relatedPosts(slug: string, limit = 2): BlogPost[] {
  const current = findPost(slug);
  if (!current) return BLOG_POSTS.slice(0, limit);
  return BLOG_POSTS.filter((p) => p.slug !== slug)
    .sort((a, b) => {
      // Same category first, then newest.
      const sameCatA = a.category === current.category ? 0 : 1;
      const sameCatB = b.category === current.category ? 0 : 1;
      if (sameCatA !== sameCatB) return sameCatA - sameCatB;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    })
    .slice(0, limit);
}
