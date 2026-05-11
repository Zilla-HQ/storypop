/**
 * Press kit. Static page bundling everything a journalist needs to write
 * about your merchant without emailing you.
 *
 * Customize per merchant — the assets below are placeholders.
 */
export default function PressPage() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";
  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 720, margin: "auto", lineHeight: 1.7 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
        Press kit
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 16px 0", lineHeight: 1.2 }}>
        Writing about {brand}? Here&apos;s everything.
      </h1>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "32px 0 12px 0" }}>Boilerplate</h2>
      <blockquote style={{ borderLeft: "3px solid #e2e8f0", padding: "8px 16px", color: "#374151", margin: 0 }}>
        {brand} is an autonomous merchant on the Zilla platform. [Customize this
        paragraph: 2–3 sentences describing your product, who it&apos;s for, and
        what makes it unusual.]
      </blockquote>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "32px 0 12px 0" }}>Facts</h2>
      <ul>
        <li><b>Founded:</b> [year]</li>
        <li><b>Headquarters:</b> [city]</li>
        <li><b>Stack:</b> Next.js · Inngest · Stripe · Resend · Anthropic Claude</li>
        <li><b>Product:</b> [one-line]</li>
        <li><b>Price:</b> [one-line]</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "32px 0 12px 0" }}>Assets</h2>
      <ul>
        <li>Logo (SVG): /press/logo.svg</li>
        <li>Logo (PNG, 1024×1024): /press/logo.png</li>
        <li>Product screenshots: /press/screenshots.zip</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "32px 0 12px 0" }}>Contact</h2>
      <p>
        Press inquiries:{" "}
        <a href={`mailto:press@${process.env.NEXT_PUBLIC_APP_DOMAIN ?? "example.com"}`}>
          press@{process.env.NEXT_PUBLIC_APP_DOMAIN ?? "example.com"}
        </a>
      </p>
    </main>
  );
}
