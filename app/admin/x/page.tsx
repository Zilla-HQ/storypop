import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, adminSettings, xMentions } from "@/db";
import { eq, desc } from "drizzle-orm";
import { TweetComposer } from "@/components/admin/tweet-composer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminXPage() {
  const [s] = await db
    .select({
      token: adminSettings.xRefreshToken,
      username: adminSettings.xUsername,
      sinceId: adminSettings.xMentionsSinceId,
    })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  const authorized = Boolean(s?.token);

  const recentMentions = authorized
    ? await db
        .select()
        .from(xMentions)
        .orderBy(desc(xMentions.createdAt))
        .limit(20)
    : [];

  const hasHqCreds = Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const brandHandle = process.env.X_BRAND_HANDLE ?? s?.username ?? null;
  const brandConfigured = Boolean(process.env.X_BRAND_NAME && process.env.X_BRAND_HANDLE && process.env.X_BRAND_ABOUT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">X (Twitter)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Post tweets + threads from the merchant&apos;s brand X account, and
          let Claude auto-reply to @mentions every 30 minutes. See{" "}
          <code>X.md</code> for the full runbook.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row
            label="X_CLIENT_ID / X_CLIENT_SECRET (HQ-shared)"
            ok={hasHqCreds}
            help="From the Zilla HQ X dev app — paste from platform vault."
          />
          <Row
            label="ANTHROPIC_API_KEY (auto-reply)"
            ok={hasAnthropic}
            help="Claude Haiku evaluates each mention. Without this, the cron skips."
          />
          <Row
            label="X_BRAND_NAME + X_BRAND_HANDLE + X_BRAND_ABOUT"
            ok={brandConfigured}
            help="Per-merchant brand prompt. Without these the auto-reply uses a generic SMB fallback."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand-account authorization</CardTitle>
        </CardHeader>
        <CardContent>
          {authorized ? (
            <p className="text-sm text-emerald-700">
              ✓ Refresh token saved
              {s?.username ? (
                <>
                  {" "}for <code>@{s.username}</code>
                </>
              ) : null}
              . Posting + mentions polling are live.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-amber-900">
                Not authorized yet. Open the link below in a browser
                logged into X as the merchant&apos;s brand account:
              </p>
              <a
                href="/api/auth/x/start"
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Authorize brand account →
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
            <TweetComposer brandHandle={brandHandle} />
          </CardContent>
        </Card>
      ) : null}

      {authorized ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent @mentions ({recentMentions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Watermark <code>since_id</code>:{" "}
              <code>{s?.sinceId ?? "(none — first run will pull last ~20)"}</code>
            </p>
            {recentMentions.length === 0 ? (
              <p className="text-muted-foreground">
                No mentions yet. The poll runs every 30 minutes; trigger it
                manually with the <code>x-mentions/poll</code> Inngest event.
              </p>
            ) : (
              <ul className="divide-y">
                {recentMentions.map((m) => (
                  <li key={m.id} className="space-y-1 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs">
                        @{m.authorUsername ?? m.authorId}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          m.decision === "replied"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.decision === "skipped"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {m.decision}
                      </span>
                    </div>
                    <p className="text-xs">{m.text}</p>
                    <p className="text-xs text-muted-foreground">{m.reasoning}</p>
                    {m.replyText ? (
                      <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-900">
                        ↪ {m.replyText}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, ok, help }: { label: string; ok: boolean; help: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={ok ? "text-emerald-700" : "text-amber-700"}>
        {ok ? "✓" : "○"}
      </span>
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{help}</div>
      </div>
    </div>
  );
}
