import Link from "next/link";
import { db, listings, previews } from "@/db";
import { desc, eq, sql, and, ne } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PostcardsIndex() {
  // Listings that have at least one preview row + a real address (not "Loading…")
  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      address: listings.address,
      city: listings.city,
      state: listings.state,
      zip: listings.zip,
      previewCount: sql<number>`(SELECT count(*)::int FROM relist.previews p WHERE p.listing_id = ${listings.id})`,
      latestServiceId: sql<string | null>`(SELECT service_id FROM relist.previews p WHERE p.listing_id = ${listings.id} ORDER BY p.created_at DESC LIMIT 1)`,
    })
    .from(listings)
    .where(and(ne(listings.address, "Loading…"), ne(listings.address, "")))
    .orderBy(desc(listings.createdAt))
    .limit(50);

  const eligible = rows.filter((r) => Number(r.previewCount) > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Postcard previews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Render the front + back of the Lob postcard for any listing that has a
          generated preview. Test mode — no postcard is actually mailed.
        </p>
      </div>

      <Card className="border-amber-500/50 bg-amber-50/60">
        <CardContent className="space-y-1 p-4 text-sm">
          <div>
            <b>Mailer enabled?</b> Off by default. Toggle{" "}
            <code>relist.admin_settings.mailer_enabled</code> = true to start mailing.
          </div>
          <div>
            <b>Lob mode</b>: test (no real mail). Swap{" "}
            <code>LOB_API_KEY</code> to a live secret to print + ship.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {eligible.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {shortAddress(r.address)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.city}, {r.state} {r.zip}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="secondary">{r.previewCount} preview(s)</Badge>
                  {r.latestServiceId && (
                    <Badge variant="outline">{r.latestServiceId}</Badge>
                  )}
                </div>
              </div>
              <Button asChild size="sm">
                <Link href={`/admin/postcards/${r.id}`}>Preview</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {eligible.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No listings with previews yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
