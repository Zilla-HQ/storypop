/**
 * Affiliate swipe-file kit. Copy-paste templates partners can use
 * verbatim — email, social, blog. Saves partners from having to
 * write their own copy, which is the #1 cause of affiliate program
 * drop-off after signup.
 *
 * Customize the snippets below per merchant. The structure is the
 * SiteGrid pattern: three categories, each with 2-3 short variants.
 */

import Link from "next/link";

export const dynamic = "force-static";

export default function PartnersKitPage() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").replace(/\/$/, "");
  const price = process.env.NEXT_PUBLIC_PRICE_LABEL ?? "$199 once";
  const productNoun = process.env.NEXT_PUBLIC_PRODUCT_NOUN ?? "product";
  const yourCode = "YOURNAME"; // partners replace at copy-time

  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 760, margin: "auto", lineHeight: 1.6 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
        Affiliate kit
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 12px 0", lineHeight: 1.2 }}>
        Copy. Paste. Earn.
      </h1>
      <p style={{ color: "#374151" }}>
        Replace <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>{yourCode}</code> with your code,
        then use these in your channel of choice.
      </p>

      <Section title="Your link">
        <Code>{`${appUrl}/ref/${yourCode}`}</Code>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          90-day cookie. Every purchase in that window is yours.{" "}
          <Link href="/partners" style={{ color: "#0f766e" }}>
            See the tier ladder →
          </Link>
        </p>
      </Section>

      <Section title="Email — short">
        <CodeBlock>{`Subject: ${brand} — ${price}, ready in 24 hours

Hi {firstName},

Quick heads up — I've been using ${brand} and they build ${productNoun}s for ${price}, ready in 24 hours. Pulled from your real Google profile data, no monthly subscription.

If it's a fit, my link is ${appUrl}/ref/${yourCode}. They throw me a referral fee if you buy; no markup on your end.

— Your name`}</CodeBlock>
      </Section>

      <Section title="Email — long">
        <CodeBlock>{`Subject: ${brand} for [their business name]?

Hi {firstName},

I know you've been thinking about [website / [other product]] — I just used ${brand} and thought I'd pass it on.

What's different about them:
  • ${price}. No subscription. You own it.
  • Live in 24 hours, pulled from your real Google profile data.
  • Mobile-first, real photos, hours, reviews already inside.

If it's worth a look: ${appUrl}/ref/${yourCode}

They pay me a referral fee if you sign up — no markup on your end, just my way of saying I'd recommend it.

— Your name`}</CodeBlock>
      </Section>

      <Section title="Social — Twitter / X">
        <CodeBlock>{`Most small businesses need a website but won't pay $750/mo for one.

${brand} ships them for ${price}, ready in 24h, pulled from real Google profile data.

${appUrl}/ref/${yourCode}`}</CodeBlock>
        <CodeBlock>{`Just used ${brand} — local-business website built from the customer's actual Google profile in 24 hours. ${price}.

Recommending it to every small-business owner I know.

${appUrl}/ref/${yourCode}`}</CodeBlock>
      </Section>

      <Section title="Social — LinkedIn">
        <CodeBlock>{`If you run a local service business and you're still on a $20/mo Wix site (or worse, a 2014 agency site costing $750/mo), this is worth a look.

${brand} builds you a clean, mobile-first website for ${price}, pulled from your actual Google profile in 24 hours. No subscription. No catch.

I get a referral fee if you sign up via my link — no markup on your end.

${appUrl}/ref/${yourCode}`}</CodeBlock>
      </Section>

      <Section title="Social — Instagram caption">
        <CodeBlock>{`If you need a website and you've been putting it off — ${brand} just made it cheap and fast.

${price}, live in 24 hours. ${appUrl}/ref/${yourCode} in the comments.`}</CodeBlock>
      </Section>

      <Section title="Blog snippet">
        <CodeBlock>{`## ${brand}

Built for local service businesses that need a website but don't want a $750/mo agency contract or a $20/mo subscription forever.

- ${price}. No subscription.
- Live in 24 hours.
- Pulled from your real Google profile data — photos, hours, reviews.

If you're shopping, my link is here: [${brand}](${appUrl}/ref/${yourCode}).
*Disclosure: I earn a referral fee if you sign up. No markup on your end.*`}</CodeBlock>
      </Section>

      <Section title="One-line for podcast / newsletter sponsorship">
        <CodeBlock>{`This episode's brought to you by ${brand} — done-for-you websites for local businesses, ${price}, ready in 24 hours. Try it at ${appUrl}/ref/${yourCode}.`}</CodeBlock>
      </Section>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "40px 0 12px 0" }}>Rules</h2>
      <ul>
        <li>Don't spam. Mass-DM is a fast track to a banned code.</li>
        <li>Disclose the affiliate relationship (FTC, ASA, etc).</li>
        <li>Don't bid on our brand name in paid search.</li>
        <li>No fake testimonials. If you didn't use it, don't say you love it.</li>
      </ul>
    </main>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: "40px 0" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px 0" }}>{props.title}</h2>
      {props.children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <div
      style={{
        background: "#0f172a",
        color: "#f8fafc",
        padding: "12px 16px",
        borderRadius: 8,
        fontFamily: "Menlo, monospace",
        fontSize: 14,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        padding: "16px 18px",
        borderRadius: 10,
        fontFamily: "Menlo, monospace",
        fontSize: 13,
        whiteSpace: "pre-wrap",
        margin: "0 0 16px 0",
        color: "#0f172a",
      }}
    >
      {children}
    </pre>
  );
}
