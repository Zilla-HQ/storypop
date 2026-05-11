import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmailDetail } from "@/lib/resend-stats";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminEmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = await getEmailDetail(id);
  if (!email) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/emails"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All emails
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{email.subject || "(no subject)"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          To: <code className="rounded bg-muted px-1.5 py-0.5">{email.to.join(", ")}</code> ·
          From: <code className="rounded bg-muted px-1.5 py-0.5">{email.from}</code> ·
          Status:{" "}
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {email.lastEvent || "?"}
          </span>{" "}
          · Sent: <span>{email.createdAt}</span>
        </p>
        {email.error ? (
          <p className="mt-2 text-sm text-red-600">⚠️ {email.error}</p>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rendered email (HTML)
          </div>
          {email.html ? (
            <iframe
              srcDoc={email.html}
              className="h-[800px] w-full"
              sandbox="allow-same-origin"
              title="Rendered email"
            />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No HTML body returned by Resend.
            </div>
          )}
        </CardContent>
      </Card>

      {email.text ? (
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plain-text version
            </div>
            <pre className="whitespace-pre-wrap rounded bg-muted/50 p-4 text-xs">
              {email.text}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
