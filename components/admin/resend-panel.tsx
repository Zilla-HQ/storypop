import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { fetchResendSnapshot } from "@/lib/resend-stats";

const STATUS_TONE: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  opened: "bg-blue-50 text-blue-700 border-blue-200",
  clicked: "bg-purple-50 text-purple-700 border-purple-200",
  bounced: "bg-rose-50 text-rose-700 border-rose-200",
  complained: "bg-amber-50 text-amber-800 border-amber-200",
  unsubscribed: "bg-slate-100 text-slate-600 border-slate-200",
  queued: "bg-slate-50 text-slate-500 border-slate-200",
  sent: "bg-slate-50 text-slate-600 border-slate-200",
};

function tone(status: string): string {
  return STATUS_TONE[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Live snapshot of Resend email activity. Filters by SENDER_DOMAINS env so
 * only emails from this merchant's verified domains show up — keeps the
 * panel meaningful when the Resend account is shared across merchants.
 */
export async function ResendPanel() {
  // Use first sender domain as the filter ("mail.restay.agency" → filter for "restay.agency")
  const senderDomain = (process.env.SENDER_DOMAINS ?? "")
    .split(",")[0]
    ?.trim()
    .replace(/^mail\./, "");
  const stats = await fetchResendSnapshot(senderDomain || undefined);

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resend deliverability (live)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Resend API unreachable or RESEND_API_KEY not set.
          </p>
        </CardContent>
      </Card>
    );
  }

  const deliveryRate = stats.total > 0 ? ((stats.delivered + stats.opened + stats.clicked) / stats.total) * 100 : 0;
  const bounceRate = stats.total > 0 ? (stats.bounced / stats.total) * 100 : 0;
  const openRate = stats.delivered > 0 ? (stats.opened / (stats.delivered + stats.opened + stats.clicked)) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Resend deliverability (live snapshot, last 100 sends)</span>
          <span className="text-sm font-normal text-muted-foreground">
            filtered to {senderDomain ?? "all"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top-line metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Total" value={stats.total} />
          <Metric label="Delivered" value={stats.delivered} tone={stats.delivered > 0 ? "ok" : "neutral"} />
          <Metric label="Opened" value={stats.opened} tone={stats.opened > 0 ? "ok" : "neutral"} />
          <Metric label="Clicked" value={stats.clicked} tone={stats.clicked > 0 ? "ok" : "neutral"} />
          <Metric label="Bounced" value={stats.bounced} tone={stats.bounced > 0 ? "warn" : "neutral"} />
          <Metric label="Complained" value={stats.complained} tone={stats.complained > 0 ? "danger" : "neutral"} />
          <Metric label="Unsubscribed" value={stats.unsubscribed} />
          <Metric label="In flight" value={stats.pending} />
        </div>

        {/* Rates */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Rate label="Delivery rate" pct={deliveryRate} good={deliveryRate >= 95} bad={deliveryRate < 90} />
          <Rate label="Bounce rate" pct={bounceRate} good={bounceRate < 2} bad={bounceRate > 5} invert />
          <Rate label="Open rate" pct={openRate} good={openRate > 25} bad={openRate < 10} />
        </div>

        {/* Per-domain (if multiple sender domains) */}
        {stats.byDomain.length > 1 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sender domain
            </div>
            <div className="space-y-1">
              {stats.byDomain.slice(0, 5).map((d) => (
                <div key={d.domain} className="flex items-center justify-between text-sm">
                  <code className="text-xs">{d.domain}</code>
                  <span className="tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent emails */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent emails
          </div>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent emails for this domain.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">When</th>
                    <th className="px-3 py-2 text-left font-medium">To</th>
                    <th className="px-3 py-2 text-left font-medium">Subject</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.recent.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        <Link href={`/admin/email/${e.id}`} className="block">{relativeTime(e.created_at)}</Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Link href={`/admin/email/${e.id}`} className="block">
                          {(e.to ?? []).slice(0, 1).join(", ") || "—"}
                          {e.to?.length > 1 && (
                            <span className="text-muted-foreground"> +{e.to.length - 1}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Link href={`/admin/email/${e.id}`} className="block hover:underline">
                          <span className="line-clamp-1 max-w-md">{e.subject || "(no subject)"}</span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link href={`/admin/email/${e.id}`} className="block">
                          <Badge variant="outline" className={tone(e.last_event)}>
                            {e.last_event}
                          </Badge>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const valueColor =
    tone === "ok" ? "text-emerald-700"
      : tone === "warn" ? "text-amber-700"
      : tone === "danger" ? "text-rose-700"
      : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}

function Rate({
  label,
  pct,
  good,
  bad,
  invert,
}: {
  label: string;
  pct: number;
  good: boolean;
  bad: boolean;
  invert?: boolean;
}) {
  const isGood = invert ? !bad : good;
  const isBad = invert ? !good : bad;
  const color = isGood ? "text-emerald-700" : isBad ? "text-rose-700" : "text-amber-700";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{pct.toFixed(1)}%</div>
    </div>
  );
}
