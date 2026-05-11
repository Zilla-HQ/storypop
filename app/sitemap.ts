import type { MetadataRoute } from "next";
import { CITIES, citiesForService } from "@/lib/cities";
import { env } from "@/lib/env";

const BASE = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

/**
 * Sitemap enumerates every static + programmatic URL we want indexed.
 * Programmatic surface = 5 templates × ~75 cities = ~350 URLs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,            changeFrequency: "weekly",  priority: 1.0,  lastModified: now },
    { url: `${BASE}/agents`,      changeFrequency: "weekly",  priority: 0.95, lastModified: now },
    { url: `${BASE}/renovate`,    changeFrequency: "weekly",  priority: 0.95, lastModified: now },
    { url: `${BASE}/services`,    changeFrequency: "monthly", priority: 0.7,  lastModified: now },
    { url: `${BASE}/disclosure`,  changeFrequency: "yearly",  priority: 0.3,  lastModified: now },
    { url: `${BASE}/terms`,       changeFrequency: "yearly",  priority: 0.2,  lastModified: now },
    { url: `${BASE}/privacy`,     changeFrequency: "yearly",  priority: 0.2,  lastModified: now },
    { url: `${BASE}/tools/photo-score`, changeFrequency: "weekly", priority: 0.9, lastModified: now },
    { url: `${BASE}/refer`,       changeFrequency: "monthly", priority: 0.5,  lastModified: now },
  ];

  const virtualStaging: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${BASE}/virtual-staging/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.85,
    lastModified: now,
  }));

  const twilight: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${BASE}/twilight-photos/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: now,
  }));

  const poolCost: MetadataRoute.Sitemap = citiesForService("pool-mockup").map((c) => ({
    url: `${BASE}/pool-cost/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.85,
    lastModified: now,
  }));

  const solar: MetadataRoute.Sitemap = citiesForService("solar-mockup").map((c) => ({
    url: `${BASE}/solar-payback/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.85,
    lastModified: now,
  }));

  const curbAppeal: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${BASE}/curb-appeal/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: now,
  }));

  return [...staticPages, ...virtualStaging, ...twilight, ...poolCost, ...solar, ...curbAppeal];
}
