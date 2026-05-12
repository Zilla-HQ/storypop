import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

const BASE = env("NEXT_PUBLIC_APP_URL", "https://storypop.shop")!;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Don't index admin, internal APIs, or per-listing landing pages
        // (those are personalized cold-email / preview destinations and
        // shouldn't get crawled into search results).
        disallow: [
          "/admin",
          "/admin/*",
          "/api/*",
          "/l/*",
          "/generating/*",
          "/checkout/*",
          "/delivery/*",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
