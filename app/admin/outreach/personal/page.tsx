import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutreachCard } from "@/components/admin/outreach-card";
import { TIER_1, PODCASTS } from "@/lib/outreach";

// Renders <UserButton/> via the admin layout, which requires live ClerkProvider
// context — incompatible with Next.js static prerender. Force dynamic so
// the build doesn't try to prerender this without a ClerkProvider env.
export const dynamic = "force-dynamic";

export default function AdminOutreachPersonalPage() {
  return (
    <div className="container max-w-5xl space-y-8 py-8">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Personal outreach
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tier-1 affiliate emails and podcast sponsor inquiries — all drafted,
          one click to open in Gmail. Sent state persists in your browser.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tier-1 affiliate outreach</span>
            <span className="text-xs font-normal text-muted-foreground">
              {TIER_1.length} drafts · personal sends
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Personalize each opener (one line about their latest content) before
            sending. Don't BCC, don't send all on the same minute. One bump email
            after 7 days if no reply, then drop.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {TIER_1.map((draft) => (
              <OutreachCard key={draft.id} draft={draft} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Podcast sponsorship inquiries</span>
            <span className="text-xs font-normal text-muted-foreground">
              {PODCASTS.length} drafts · send Thu/Fri AM
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Sponsor inboxes are emptiest end-of-week. Track replies, not opens —
            sponsor inboxes are usually shared and bots skew opens. If they
            respond, ask for past-3-episode download numbers before negotiating.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {PODCASTS.map((draft) => (
              <OutreachCard key={draft.id} draft={draft} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tier-2 batch (50 prospects)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The 50-prospect Tier-2 list lives at{" "}
            <code className="text-xs">docs/outreach/affiliate-tier2-list.md</code>{" "}
            with personal hooks; the bulk template lives at{" "}
            <code className="text-xs">docs/outreach/affiliate-tier2.md</code>.
            Send pace is 5–10/day max. Top 5 priorities by ICP fit:
          </p>
          <ol className="ml-5 list-decimal space-y-1 text-sm">
            <li><strong>Evelyn Badia</strong> — The Hosting Journey (5k FB community + 14yr Superhost)</li>
            <li><strong>Alisha Arnold</strong> — STR Lab (Kajabi course)</li>
            <li><strong>James Svetec</strong> — BNB Mastery (co-host community)</li>
            <li><strong>Tim Hubbard</strong> — STR Riches podcast</li>
            <li><strong>NASTRA</strong> — Nashville STR Association (vetted vendor pipeline)</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            These are not in the Gmail-compose UI above because each needs a
            light personalization on top of the template — open the markdown,
            copy your hook, paste-and-send via your normal Gmail flow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
