export const metadata = { title: "Privacy Policy — Realscale" };

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>

      <div className="prose prose-slate mt-8 max-w-none space-y-4 text-[15px] leading-7">
        <h2 className="mt-6 text-xl font-semibold">What we collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <b>Listing data</b> — address, price, photos, and agent contact information
            scraped from public MLS listings (Zillow, Redfin, Realtor.com) or submitted
            by you directly.
          </li>
          <li>
            <b>Customer data</b> — email and payment metadata when you place an order
            through Stripe.
          </li>
          <li>
            <b>Email engagement</b> — opens, clicks, replies, bounces, and unsubscribe
            actions tied to messages we send you.
          </li>
          <li>
            <b>Usage analytics</b> — aggregated, non-identifying page views collected via
            PostHog.
          </li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">How we use it</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Generate AI-enhanced previews and deliver paid orders.</li>
          <li>Send transactional and marketing emails about Realscale.</li>
          <li>Improve our pipeline and detect fraud or abuse.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">Subprocessors</h2>
        <p>We share data with the following subprocessors strictly to operate the service:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Vercel — hosting</li>
          <li>Supabase — database</li>
          <li>Stripe — payments</li>
          <li>Resend — email delivery</li>
          <li>Cloudflare R2 — image storage</li>
          <li>Anthropic, fal.ai, OpenAI — AI inference (image generation, scoring)</li>
          <li>Apify — listing data scraping</li>
          <li>PostHog — analytics</li>
          <li>Inngest — workflow orchestration</li>
          <li>Clerk — admin auth (Realscale operators only)</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">Retention</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Source photos: deleted 30 days after delivery</li>
          <li>Enhanced photos: retained for the life of your account so you can re-download</li>
          <li>Email engagement records: retained for 24 months for deliverability analysis</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">Your choices</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <b>Unsubscribe</b> — every email we send includes a one-click unsubscribe
            link. Once you unsubscribe we won't email you again about your listings.
          </li>
          <li>
            <b>Deletion</b> — email{" "}
            <a href="mailto:hello@realscale.app" className="text-primary hover:underline">
              hello@realscale.app
            </a>{" "}
            from the address on file to request deletion of all data associated with you
            or your listings. We delete within 30 days.
          </li>
          <li>
            <b>California / GDPR rights</b> — California residents and EU residents have
            the right to access, correct, or delete personal data we hold about them. Use
            the contact email above and we will respond within 30 days.
          </li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">Contact</h2>
        <p>
          <a href="mailto:hello@realscale.app" className="text-primary hover:underline">
            hello@realscale.app
          </a>
          <br />
          3500 South Dupont Highway, Dover, DE 19901
        </p>
      </div>
    </div>
  );
}
