import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env("NEXT_PUBLIC_APP_URL", "https://storypop.shop");
  const now = new Date();
  // StoryPop is B2C; the sitemap stays minimal in v1. Add programmatic
  // `/for/[occasion]` and `/samples/[archetype]` entries here once those
  // routes ship (see docs/growth-plan.md Phase 2).
  return [
    { url: `${base}/`, lastModified: now, priority: 1.0 },
    { url: `${base}/create`, lastModified: now, priority: 0.9 },
    { url: `${base}/samples`, lastModified: now, priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, priority: 0.2 },
  ];
}
