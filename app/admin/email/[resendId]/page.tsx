import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchResendEmail } from "@/lib/resend-stats";
import { db, outreachEvents, listings } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ resendId: string }>;
}

const STATUS_TONE: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  opened: "bg-blue-50 text-blue-700 border-blue-200",
  clicked: "bg-purple-50 text-purple-700 border-purple-200",
  bounced: "bg-rose-50 text-rose-700 border-rose-200",
  complained: "bg-amber-50 text-amber-800 border-amber-200",
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function EmailDetailPage({ params }: PageProps) {
  const { resendId } = await params;

  const email = await fetchResendEmail(resendId);
  if (!email) notFound();

  // Cross-reference with our DB to enrich with listing info
  const [evt] = await db
    .select({ event: outreachEvents, listing: listings })
    .from(outreachEvents)
    .leftJoin(listings, eq(outreachEvents.listingId, listings.id))
    .where(eq(outreachEvents.resendId, resendId))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/outreach" className="text-xs text-muted-foreground hover:underline">
          ← Back to outreach
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{email.subject ?? "(no subject)"}</h1>
        <div className="mt-1 text-sm text-muted-foreground">Resend ID: <code>{email.id}</code></div>
      </div>

      {/* Metadata bar */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
          <Field label="From" value={email.from} mono />
          <Field label="To" value={(email.to ?? []).join(", ") || "—"} mono />
          <Field label="Sent at" value={fmt(email.created_at)} />
          <Field
            label="Status"
            value={
              <Badge variant="outline" className={STATUS_TONE[email.last_event] ?? ""}>
                {email.last_event}
              </Badge>
            }
          />
          {email.reply_to && email.reply_to.length > 0 && (
            <Field label="Reply-To" value={email.reply_to.join(", ")} mono />
          )}
          {evt?.listing && (
            <Field
              label="Listing"
              value={
                <Link href={`/admin/outreach/${evt.event.id}`} className="text-primary hover:underline">
                  {evt.listing.address || evt.listing.scrapedTitle || evt.listing.id.slice(0, 8)}
                </Link>
              }
            />
          )}
          {evt?.listing?.agentName && (
            <Field label="Host" value={evt.listing.agentName} />
          )}
        </CardContent>
      </Card>

      {/* HTML preview rendered in sandboxed iframe */}
      <Card>
        <CardHeader>
          <CardTitle>Rendered HTML</CardTitle>
        </CardHeader>
        <CardContent>
          {email.html ? (
            <iframe
              srcDoc={email.html}
              sandbox="allow-same-origin"
              className="h-[800px] w-full rounded-md border bg-white"
              title="Email preview"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No HTML content (plain-text only email).</p>
          )}
        </CardContent>
      </Card>

      {/* Plain-text fallback */}
      {email.text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plain-text version</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-xs leading-relaxed">
              {email.text}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* External link */}
      <div className="text-xs text-muted-foreground">
        View this email in Resend's dashboard:{" "}
        <a
          href={`https://resend.com/emails/${email.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          resend.com/emails/{email.id.slice(0, 8)}…
        </a>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 ${mono ? "font-mono text-xs" : ""} break-words`}>{value}</div>
    </div>
  );
}
