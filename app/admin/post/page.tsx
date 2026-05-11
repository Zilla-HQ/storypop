import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, adminSettings } from "@/db";
import { eq } from "drizzle-orm";
import { TweetComposer } from "@/components/admin/tweet-composer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPostPage() {
  const [s] = await db
    .select({ token: adminSettings.xRefreshToken, username: adminSettings.xUsername })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  const authorized = Boolean(s?.token);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Post to X</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a tweet or a thread from <code>@Sitebeatapp</code> via the X
          v2 API. Single tweet → one post. Multi-line with blank-line
          separators → a thread (each line is a reply to the prior one).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authorization</CardTitle>
        </CardHeader>
        <CardContent>
          {authorized ? (
            <p className="text-sm text-emerald-700">
              ✓ Refresh token saved. We can post to <code>@Sitebeatapp</code>.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-amber-900">
                Not authorized yet. Open this URL in a browser logged into
                X as <code>@Sitebeatapp</code>:
              </p>
              <a
                href="/api/auth/x/start"
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Authorize @Sitebeatapp →
              </a>
              <p className="text-xs text-muted-foreground">
                X will redirect back to <code>/api/auth/x/callback</code>
                where the refresh token is saved.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {authorized ? (
        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent>
            <TweetComposer />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
