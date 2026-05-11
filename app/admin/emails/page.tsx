import Link from "next/link";
import { listSitebeatEmails } from "@/lib/resend-stats";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  delivered: "bg-emerald-500/10 text-emerald-700",
  opened: "bg-blue-500/10 text-blue-700",
  clicked: "bg-blue-500/10 text-blue-700",
  bounced: "bg-red-500/10 text-red-700",
  complained: "bg-red-500/10 text-red-700",
  suppressed: "bg-amber-500/10 text-amber-700",
  replied: "bg-emerald-500/10 text-emerald-700",
};

export default async function AdminEmailsPage() {
  const emails = await listSitebeatEmails(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every Sitebeat-from email Resend has logged ({emails.length} shown).
          Click any row to read the full rendered email.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {emails.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No emails sent yet, or RESEND_API_KEY isn&rsquo;t configured.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {e.createdAt
                        ? `${e.createdAt.slice(11, 16)}Z ${e.createdAt.slice(0, 10)}`
                        : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5">{e.to}</td>
                    <td className="max-w-[300px] truncate px-4 py-2.5 font-medium">
                      {e.subject}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[e.lastEvent.toLowerCase()] ?? "bg-muted"}`}
                      >
                        {e.lastEvent || "?"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/emails/${e.id}`}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Read →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
