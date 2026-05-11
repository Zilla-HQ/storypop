import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/footer";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Partner program — earn 30% lifetime — Sitebeat",
  description:
    "Sitebeat's affiliate program pays 30% lifetime commission on every paying customer you refer. Built for web designers, SEO freelancers, marketing consultants, and WordPress devs.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
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
            <Link href="/blog" className="text-muted-foreground hover:text-foreground">
              Blog
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link
              href="/"
              className="rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
            >
              Free audit
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-3xl flex-1 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Partner program
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Earn 30% lifetime on every customer you refer
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Sitebeat&rsquo;s partner program pays 30% lifetime commission on
          every paying customer you refer. Built for web designers, SEO
          freelancers, marketing consultants, and WordPress devs who
          manage client sites and want a low-friction monitoring tool to
          recommend.
        </p>

        <section className="mt-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-emerald-50 p-6 text-center">
            <div className="text-4xl font-bold text-emerald-700">30%</div>
            <div className="mt-2 text-xs uppercase tracking-wider">
              Lifetime commission
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Paid every month the customer stays subscribed.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="text-4xl font-bold">60-day</div>
            <div className="mt-2 text-xs uppercase tracking-wider">
              Cookie window
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              From first click to subscription, you stay attributed.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="text-4xl font-bold">No fees</div>
            <div className="mt-2 text-xs uppercase tracking-wider">
              To join
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              No setup costs, no minimums, no annual fees.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight">
            How it works
          </h2>
          <ol className="mt-6 space-y-4">
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                1
              </span>
              <div>
                <h3 className="font-semibold">Email{" "}
                  <a
                    href="mailto:partners@sitebeat.tech"
                    className="text-emerald-700 underline-offset-2 hover:underline"
                  >
                    partners@sitebeat.tech
                  </a>{" "}
                  to request a ref code
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us your business, your audience, and how you plan
                  to recommend Sitebeat. We approve most applications
                  within 24 hours.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                2
              </span>
              <div>
                <h3 className="font-semibold">
                  Share your referral link
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Append <code className="rounded bg-muted px-1.5 py-0.5">?ref=YOUR_CODE</code>{" "}
                  to any Sitebeat URL. Visitors who arrive via your link
                  are tagged for 60 days.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                3
              </span>
              <div>
                <h3 className="font-semibold">
                  Get paid every month they stay subscribed
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  We pay out monthly via Stripe Connect. 30% of $29 = $8.70/mo per active referral. 100 active referrals = $870/mo recurring.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight">
            Who this works for
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold">Web design agencies</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Recommend Sitebeat as a $29/mo monitoring add-on for
                every client launch. Track 20+ client sites for under
                $600/mo total.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold">SEO freelancers</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Use Sitebeat as your post-engagement monitoring layer.
                Hand the client a tool that catches regressions after
                you&rsquo;re gone.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold">Marketing consultants</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Bundle Sitebeat into your retainer. The $29 cost is
                invisible against most consulting fees.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold">WordPress developers</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Install our free WP plugin on every client site you
                build. Each one becomes a candidate paying customer.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-xl border bg-emerald-50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Ready to apply?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Email us with your name, business, audience, and a sentence
            on how you plan to use Sitebeat. We&rsquo;ll have you set up
            within 24 hours.
          </p>
          <a
            href="mailto:partners@sitebeat.tech?subject=Partner%20program%20application"
            className="mt-6 inline-block rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            partners@sitebeat.tech →
          </a>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-bold tracking-tight">FAQ</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((q) => (
              <details
                key={q.q}
                className="group rounded-lg border bg-background p-5 [&_summary]:cursor-pointer"
              >
                <summary className="flex items-center justify-between gap-3 font-semibold">
                  {q.q}
                  <span className="text-muted-foreground transition group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.a}</p>
              </details>
            ))}
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ.map((q) => ({
                "@type": "Question",
                name: q.q,
                acceptedAnswer: { "@type": "Answer", text: q.a },
              })),
            }),
          }}
        />
      </main>

      <Footer />
    </div>
  );
}

const FAQ = [
  {
    q: "How and when do I get paid?",
    a: "Monthly, via Stripe Connect. We pay on the 5th of the month for the previous month's earnings. Payments under $50 roll over to the next month.",
  },
  {
    q: "Is there a minimum to join?",
    a: "No. We approve serious applications regardless of audience size. We do reject obvious spam (no website, no relevant audience, etc.).",
  },
  {
    q: "Can I run paid ads to my referral link?",
    a: "Yes — but you cannot bid on Sitebeat brand keywords (e.g., 'sitebeat seo'), use our trademark in ad copy, or impersonate Sitebeat in ads. Otherwise paid traffic is fine.",
  },
  {
    q: "What's the cookie window?",
    a: "60 days. If a visitor clicks your referral link and subscribes within 60 days, you're attributed.",
  },
  {
    q: "Can I refund a customer's first month?",
    a: "Customers manage their own billing through Stripe's customer portal. We process refunds at our discretion. Refunded transactions don't earn commission.",
  },
  {
    q: "Do you have a brand kit / promotional assets?",
    a: "Yes — email partners@sitebeat.tech and we'll send you logos, the embed widget code, sample copy, and screenshots.",
  },
];
