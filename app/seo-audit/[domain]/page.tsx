import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/marketing/footer";
import { AuditForm } from "@/components/audit-form";
import { PublicAuditView } from "@/components/public-audit-view";
import { findLatestPublicAudit } from "@/lib/audit-lookup";
import { normalizeDomain } from "@/lib/domain";
import { letterGrade } from "@/lib/grade";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain } = await params;
  const norm = normalizeDomain(domain);
  if (!norm) return { title: "SEO Audit — Sitebeat" };

  const audit = await findLatestPublicAudit(norm);
  if (audit) {
    const grade = letterGrade(audit.score);
    const ogImage = `/api/og?title=${encodeURIComponent(norm)}&kicker=${encodeURIComponent("SEO Audit")}&score=${audit.score}&grade=${encodeURIComponent(grade)}`;
    return {
      title: `${norm} SEO audit — Grade ${grade} (${audit.score}/100) — Sitebeat`,
      description: `Free SEO audit for ${norm}. Grade ${grade}, score ${audit.score}/100 across 13 checks. See what's failing and how to fix it.`,
      alternates: { canonical: `/seo-audit/${norm}` },
      openGraph: {
        title: `${norm} — SEO Grade ${grade}`,
        description: `Score ${audit.score}/100 across 13 SEO checks. Free audit by Sitebeat.`,
        type: "article",
        images: [ogImage],
      },
      twitter: {
        card: "summary_large_image",
        title: `${norm} — SEO Grade ${grade}`,
        description: `Score ${audit.score}/100. Free SEO audit by Sitebeat.`,
        images: [ogImage],
      },
    };
  }
  return {
    title: `Free SEO audit for ${norm} — Sitebeat`,
    description: `Run a free 13-point SEO audit on ${norm} in 30 seconds. No signup required.`,
    alternates: { canonical: `/seo-audit/${norm}` },
    robots: { index: false, follow: true },
  };
}

export default async function PublicAuditPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const norm = normalizeDomain(domain);
  if (!norm) notFound();

  const audit = await findLatestPublicAudit(norm);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Sitebeat
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/tools" className="text-muted-foreground hover:text-foreground">
              Tools
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="/" className="rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">
              Free audit
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-3xl flex-1 py-12">
        {audit ? (
          <>
            <PublicAuditView
              domain={norm}
              siteUrl={audit.siteUrl}
              score={audit.score}
              report={audit.report as never}
              runAt={audit.runAt}
            />
            {/* JSON-LD for rich-result eligibility — Review-style schema
                isn't appropriate (we're not reviewing the site as a
                product), so we ship a Dataset-flavored object describing
                the audit result. */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "Article",
                  headline: `SEO Audit for ${norm}`,
                  description: `Free 13-point SEO audit for ${norm} — score ${audit.score}/100.`,
                  datePublished: audit.runAt?.toISOString() ?? audit.createdAt.toISOString(),
                  author: { "@type": "Organization", name: "Sitebeat" },
                  publisher: {
                    "@type": "Organization",
                    name: "Sitebeat",
                    url: "https://sitebeat.tech",
                  },
                  mainEntityOfPage: `https://sitebeat.tech/seo-audit/${norm}`,
                }),
              }}
            />
          </>
        ) : (
          <EmptyState domain={norm} />
        )}
      </main>

      <Footer />
    </div>
  );
}

function EmptyState({ domain }: { domain: string }) {
  return (
    <div className="space-y-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          SEO Audit
        </p>
        <h1 className="mt-3 break-all text-4xl font-bold tracking-tight sm:text-5xl">
          {domain}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          We haven&rsquo;t audited <span className="font-semibold">{domain}</span> yet.
          Run a free 13-point SEO audit in 30 seconds — no signup required.
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <AuditForm initialUrl={domain} />
        </div>
      </div>

      <div className="grid gap-6 rounded-xl border bg-muted/30 p-8 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">What you&rsquo;ll get</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>✓ Letter grade A+ through F</li>
            <li>✓ 13 SEO checks (HTTPS, meta, headings, speed, sitemap, schema, …)</li>
            <li>✓ Exact fix instructions for every failure</li>
            <li>✓ Public shareable URL</li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Want it monitored?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Subscribe and we re-audit {domain} every Monday. We only email
            you when something regresses. $29/mo, cancel anytime.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block rounded-md border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            See pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
