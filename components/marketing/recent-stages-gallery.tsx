import { db, previews, listings } from "@/db";
import { sql } from "drizzle-orm";
import Image from "next/image";
import { env } from "@/lib/env";

const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

interface RecentStage {
  preview_id: string;
  city: string;
  state: string;
}

/**
 * Server-side social-proof gallery — surfaces 6 recent staged previews
 * (anonymized to city/state) on the listing page. Builds trust by
 * showing visitors that other listings have actually been processed.
 *
 * Uses the stable image proxy (/api/img/<previewId>) so URLs never
 * expire. Pulls only watermarked photo-staging previews — pool/solar
 * mockups don't fit the agent-side trust narrative.
 */
async function getRecentStages(excludeListingId?: string): Promise<RecentStage[]> {
  const rows = (await db.execute(sql`
    SELECT p.id as preview_id, l.city, l.state
    FROM relist.previews p
    JOIN relist.listings l ON l.id = p.listing_id
    WHERE p.service_id = 'photo-staging'
      AND p.rewatermarked_at IS NOT NULL
      AND jsonb_array_length(p.enhanced_photo_urls) > 0
      AND l.city IS NOT NULL AND l.city != ''
      AND l.state IS NOT NULL AND l.state != ''
      ${excludeListingId ? sql`AND l.id != ${excludeListingId}` : sql``}
    ORDER BY RANDOM()
    LIMIT 6
  `)) as unknown as RecentStage[];
  return rows;
}

export async function RecentStagesGallery({ excludeListingId }: { excludeListingId?: string }) {
  const stages = await getRecentStages(excludeListingId);
  if (stages.length === 0) return null;

  return (
    <section className="container mt-16 max-w-5xl">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-3 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Real output from our pipeline
        </div>
        <h2 className="text-3xl font-bold tracking-tight">
          Recently staged on Realscale.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Each of these is a real listing photo we processed — same pipeline
          your order will run through.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {stages.map((s) => (
          <div key={s.preview_id} className="overflow-hidden rounded-lg border bg-card">
            <div className="relative aspect-[4/3] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${APP_URL}/api/img/${s.preview_id}?i=0&kind=after`}
                alt={`Realscale-staged photo from ${s.city}, ${s.state}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {s.city}, {s.state}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
