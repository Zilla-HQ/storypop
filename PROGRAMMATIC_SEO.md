# PROGRAMMATIC_SEO.md — N × M landing-page generation

Generate hundreds of SEO landing pages from two short configs: a list of verticals and a list of cities. Every page is unique, structured-data-tagged, and shipped in the sitemap.

## The two URL shapes

```
/seo/website-for/<vertical>           # one page per vertical
/seo/<city>/<vertical>-website        # one page per city × vertical
```

For a merchant covering 19 verticals × 30 cities, that's `19 + 19×30 = 589` pages. All unique copy. All in the sitemap. All allowed by robots.txt.

## What the helper provides

`lib/programmatic-seo.ts` exports:

- `DEFAULT_VERTICALS` — 19 starter verticals (dental, chiro, gyms, yoga, etc.). Customize per merchant.
- `DEFAULT_CITIES` — 30 top US metros. Customize per merchant.
- `generateVerticalPages(config)` → array of vertical-only `SeoPage` objects.
- `generateCityVerticalPages(config)` → array of city×vertical `SeoPage`.
- `generateAllSeoPages(config)` → both combined.
- `sitemapEntries(config)` → ready-to-use sitemap entries.

A `SeoPage` has `url`, `path`, `title`, `description`, `h1`, `body`, `jsonLd`.

## Wiring in Next.js

Two app routes — one per URL shape — using `generateStaticParams` to materialize every combo at build time.

### Vertical pages

`app/seo/website-for/[vertical]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { generateVerticalPages, DEFAULT_VERTICALS } from "@/lib/programmatic-seo";

const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  brandName: "Merchant",
  productNoun: "website",
  priceLabel: "$199 once",
};

export function generateStaticParams() {
  return DEFAULT_VERTICALS.map((v) => ({ vertical: v.slug }));
}

export default async function Page({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const page = generateVerticalPages(config).find((p) => p.path.endsWith(`/${vertical}`));
  if (!page) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(page.jsonLd) }} />
      <main style={{ padding: 48, maxWidth: 720, margin: "auto", fontFamily: "system-ui", lineHeight: 1.6 }}>
        <h1>{page.h1}</h1>
        <p>{page.body}</p>
      </main>
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const page = generateVerticalPages(config).find((p) => p.path.endsWith(`/${vertical}`));
  if (!page) return {};
  return { title: page.title, description: page.description };
}
```

### City × vertical pages

`app/seo/[city]/[vertical]-website/page.tsx` — same shape, calling `generateCityVerticalPages(config)`.

(Next.js's app router needs a different folder structure if you want the literal `-website` suffix in the URL — use a `[verticalSuffix]` segment that contains `<vertical>-website` and parse it in the handler, or use a `[...slug]` catch-all.)

### Sitemap

`app/sitemap.ts`:

```ts
import { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/programmatic-seo";

const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  brandName: "Merchant",
  productNoun: "website",
  priceLabel: "$199 once",
};

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(config).map((e) => ({
    url: e.url,
    changeFrequency: e.changefreq as "weekly",
    priority: e.priority,
  }));
}
```

### Cache headers

`vercel.json`:

```json
{
  "headers": [
    {
      "source": "/seo/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

`no-store` means you can update the copy or vertical/city list without a deploy. The pages re-render on next request.

## Tuning per merchant

Each vertical and city is just an object — replace with your actual catalog. Example for a merchant operating only in California:

```ts
const config = {
  appUrl: "https://camerchant.example",
  brandName: "CA Merchant",
  productNoun: "website",
  priceLabel: "$199 once",
  verticals: [
    { slug: "wineries", label: "Wineries", singularLabel: "Winery", category: "hospitality" },
    // ...
  ],
  cities: [
    { slug: "san-francisco-ca", label: "San Francisco, CA" },
    { slug: "napa-ca", label: "Napa, CA" },
    // ...
  ],
};
```

## JSON-LD per page

Each `SeoPage` includes a `jsonLd` object — a `Service` schema for the vertical page, with `provider.Organization` + `areaServed` (City for city×vertical pages, "United States" for vertical-only) + `offers.Offer.price`.

Inline it via `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(page.jsonLd) }}>`.

## When it pays back

- SiteGrid hit ~10% of organic traffic from these pages within 60 days of launch.
- The conversion rate is lower than email-driven traffic, but it costs nothing to maintain and compounds.
- Most-valuable shape: the city×vertical pages (e.g. `/seo/austin-tx/dentists-website`). These rank for the long-tail searches that buyers actually type — "best website for a dentist in austin".

## What this doesn't do

- No per-page A/B testing of copy variants.
- No localized currency or language — assumes USD + English.
- No automatic featured image per page. Add `og:image` generation if you want it — `@vercel/og` is the cheap path.
