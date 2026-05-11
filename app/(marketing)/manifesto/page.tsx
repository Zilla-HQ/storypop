import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "The case against optimizing your Airbnb listing yourself — Restay",
  description:
    "An Airbnb listing is a $5,000-a-year asset run by someone who doesn't have time to optimize it. Here's why we built Restay around that single fact.",
  openGraph: {
    title: "The case against optimizing your Airbnb listing yourself",
    description:
      "An Airbnb listing is a $5,000-a-year asset run by someone who doesn't have time to optimize it. Here's why we built Restay around that single fact.",
    type: "article",
  },
};

export default function ManifestoPage() {
  return (
    <article className="container max-w-2xl py-16 sm:py-24">
      <div className="mb-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Restay · Founder note · 2026-05
      </div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
        The case against optimizing your Airbnb listing yourself.
      </h1>

      <div className="prose prose-slate mt-10 max-w-none text-[17px] leading-relaxed [&_p]:mt-5 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-foreground/90 [&_strong]:text-foreground">
        <p>
          The average Airbnb listing in a half-decent market does $5,000–$30,000 a year in
          gross bookings. That's not a side project. It's a real asset, often the host's
          second-largest after the mortgage on the property itself.
        </p>

        <p>
          And almost nobody optimizes it. Not because hosts are lazy — most are obsessive
          about their place. They optimize it once, when they list. Then life happens,
          the comp set tightens, photos that worked in 2022 stop working in 2026, and a
          listing that should be hitting 80% occupancy quietly drifts to 55%.
        </p>

        <blockquote>
          The bottleneck isn't that hosts don't know what to fix. It's that the people who
          would fix it for them charge $1,500, and the tools that promise to fix it
          themselves cost $30 a month forever.
        </blockquote>

        <h2>The actual stack of a well-optimized listing</h2>

        <p>
          Run the numbers. A listing that genuinely competes in 2026 needs four things
          done well:
        </p>

        <ul className="mt-5 list-none space-y-3 [&_li]:flex [&_li]:gap-3">
          <li>
            <span className="shrink-0 font-mono text-sm text-muted-foreground">·</span>
            <span>
              <strong>Copy</strong> — title rewritten under 50 chars leading with the
              strongest amenity, description split into Hook / Proof / Call. Hire a copywriter
              who actually understands STR conversion: <strong>$500</strong>.
            </span>
          </li>
          <li>
            <span className="shrink-0 font-mono text-sm text-muted-foreground">·</span>
            <span>
              <strong>Photos</strong> — 10+ shots that lead with experience, not floor plan.
              Hire a photographer who shoots STR specifically and does the post-edit:{" "}
              <strong>$800</strong>.
            </span>
          </li>
          <li>
            <span className="shrink-0 font-mono text-sm text-muted-foreground">·</span>
            <span>
              <strong>Pricing</strong> — weekday/weekend split, comp-set median ±10%, 30-day
              forecast. Pay an STR pricing consultant or run PriceLabs/Wheelhouse:{" "}
              <strong>$300/year minimum</strong>.
            </span>
          </li>
          <li>
            <span className="shrink-0 font-mono text-sm text-muted-foreground">·</span>
            <span>
              <strong>Review velocity</strong> — the part most hosts get wrong, where a
              two-week 20% promo unlocks more downstream revenue than a year of marginal
              changes. Free to do, but it's the lever almost nobody pulls.
            </span>
          </li>
        </ul>

        <p>
          Add it up: <strong>$1,600 plus a recurring $300+/year subscription</strong>, just
          to do the work right. For a $5,000-a-year listing, you've spent a third of one
          year's revenue before you start. For a $30,000 listing, you've still hired three
          separate vendors who don't talk to each other.
        </p>

        <p>
          The reason it costs that much isn't that the work is hard. It's that the
          existing supply of copywriters and photographers and pricing consultants is
          priced for marketing teams at hotels, not for one host doing one property.
        </p>

        <h2>What we actually realized</h2>

        <p>
          We started Restay because we kept watching this play out — the host who
          knows their listing is underperforming, knows roughly what to fix, but rationally
          can't justify $1,600 for what feels like "polish." So they don't do it. The
          listing keeps drifting. The comp next door, run by someone who hired the photographer,
          eats the booking.
        </p>

        <p>
          The realization that became Restay:
        </p>

        <blockquote>
          The work itself, on a single listing, is genuinely small. A copywriter spends
          maybe two hours on it. A photographer spends three on the edits. A pricing
          consultant spends thirty minutes pulling comps. The reason it's priced at $1,600
          isn't that it's $1,600 of work. It's that human services have to charge for
          context-switching, scheduling, deposits, revisions, and being a small business.
        </blockquote>

        <p>
          AI doesn't have those costs. It has read 50,000 listings before yours. It runs
          the rewrite, the photo restyle, and the pricing pull on the same prompt
          backbone. The marginal cost of the work itself is closer to $4 of compute. The
          marginal cost of <em>actually shipping it</em> — making the file formats right,
          QC'ing the photo edits, making sure the pricing recommendation isn't insane — is
          one human review at the end.
        </p>

        <p>
          That's the math. <strong>$79, one-time, four-hour delivery.</strong> Less than a
          single weeknight booking. Roughly 5% of what the human stack costs to do once.
        </p>

        <h2>Why one-time, not subscription</h2>

        <p>
          The temptation in this category is to build a SaaS. Charge $30/month, lock the
          host in, layer on PMS integrations and analytics dashboards. Most of our
          competitors are exactly that.
        </p>

        <p>
          We don't think that's what most hosts want. A host running 1–3 listings doesn't
          want to log in to a dashboard every Tuesday. They want the listing fixed.
          Properly. Once. Then they want to go back to running their actual life and
          glance at it again in twelve months when the comp set shifts again.
        </p>

        <p>
          So Restay is one-time. $79. No subscription, no PMS migration, no monthly
          dashboard. If twelve months from now you want it run again, that's another $79.
          The vendor we replaced — the photographer plus copywriter plus pricing consultant
          — was always going to be a one-time vendor anyway. We just priced it for the
          actual job, not for hotel-scale customers.
        </p>

        <h2>The obvious caveats</h2>

        <p>
          A first paid customer this past week refunded inside seventeen minutes. The
          pipeline had pulled Airbnb's platform-asset thumbnails (the cartoon icons used in
          the search grid for review snippets and trust badges) instead of his real
          listing photos. So he opened our delivery and saw stylized gift-box illustrations
          where his bedroom photos should have been. Which, fair — that's not what we
          promised, and the refund button is right there for exactly this case.
        </p>

        <p>
          We did three things in the next four hours: filtered the platform-asset URLs out
          of the photo source list at the scrape layer; wired a stuck-order watchdog that
          re-fires fulfillment if it stalls; and made the order-confirmation email send the
          moment Stripe hits paid, not the moment fulfillment finishes. The full
          postmortem is in our merchant-template repo if you want to read it.
        </p>

        <p>
          We mention this because the honest version of an early-stage product post is
          that the early-stage product breaks. The thing that matters is whether the
          rebuild loop is faster than the refund window. So far ours is, but the tell will
          be the second customer, not the first.
        </p>

        <h2>What this is, exactly</h2>

        <p>
          Restay is a wedge into a single observation: the optimization stack that
          professional Airbnb hosts run is too expensive to scale to the long tail, and
          the long tail is most of Airbnb. Closing that gap — and doing the work, not
          building the dashboard — is the whole product.
        </p>

        <p>
          The free grader at <Link href="/grade" className="font-semibold text-primary underline">restay.agency/grade</Link>{" "}
          gives you the score and the three highest-impact fixes for any listing in ten
          seconds. If you want the work done — copy, photos, pricing report, four-hour
          turnaround — the Tune-Up is one-time $79 and we ship it back to you the same
          day. We refund every single one that doesn't lift the listing within fourteen
          days, no questions asked. That's not a marketing line; it's the only honest
          contract for a service that promises lift.
        </p>

        <p className="!mt-12 text-sm text-muted-foreground">
          — Jack Lipstone, founder
          <br />
          jack@mail.restay.agency · <Link href="/" className="underline">restay.agency</Link>
        </p>
      </div>

      <div className="mt-16 flex flex-col items-start gap-3 rounded-lg border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Try it
          </div>
          <div className="mt-1 text-base font-semibold">
            Paste any Airbnb URL — get your 0–100 score in 10 seconds.
          </div>
        </div>
        <Link href="/grade">
          <Button size="lg">Grade my listing →</Button>
        </Link>
      </div>
    </article>
  );
}
