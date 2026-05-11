import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/footer";
import { EmbedSnippet } from "@/components/embed-snippet";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Free SEO audit widget — embed on your site | Sitebeat",
  description:
    "Drop a free SEO audit form on your agency or freelance site in 2 lines of HTML. No fees, no signup. Visitors who run an audit can subscribe to weekly monitoring — you can earn affiliate commission.",
  alternates: { canonical: "/embed" },
};

export default function EmbedLandingPage() {
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
          </nav>
        </div>
      </header>

      <main className="container max-w-3xl flex-1 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Embed widget
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Free SEO audit widget for your site
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Drop a free SEO audit form on your agency or freelance site in
          2 lines of HTML. Visitors get a real audit; you get a
          warmed-up lead. If they subscribe, you can earn an affiliate
          commission.
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight">Live preview</h2>
          <div className="mt-4 overflow-hidden rounded-lg border bg-card">
            <iframe
              src="/embed/widget"
              title="Sitebeat free SEO audit widget"
              loading="lazy"
              style={{
                width: "100%",
                height: "420px",
                border: "0",
              }}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight">Copy-paste code</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Paste this anywhere in your HTML. Replace
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              YOUR_REF_CODE
            </code>
            with your Sitebeat affiliate code (or remove the parameter).
          </p>
          <EmbedSnippet />
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">Who this is for</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>✓ Web design agencies</li>
              <li>✓ SEO freelancers</li>
              <li>✓ Marketing consultants</li>
              <li>✓ WordPress developers</li>
              <li>✓ Anyone who wants a lead-capture tool</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">What it does</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>✓ Visitor enters URL — gets full 13-check audit</li>
              <li>✓ Audit results page opens in a new tab</li>
              <li>✓ Email collected if provided</li>
              <li>✓ All free — no fees to embedders</li>
            </ul>
          </div>
        </section>

        <section className="mt-12 rounded-xl border bg-emerald-50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Earn affiliate commission</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            If a visitor who used your widget subscribes to weekly
            monitoring, you earn 30% of their subscription for the
            lifetime of the customer. Email{" "}
            <a className="font-semibold underline" href="mailto:partners@sitebeat.tech">
              partners@sitebeat.tech
            </a>{" "}
            to get your ref code.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
