export const metadata = { title: "Terms of Service — Realscale" };

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>

      <div className="prose prose-slate mt-8 max-w-none space-y-4 text-[15px] leading-7">
        <h2 className="mt-6 text-xl font-semibold">1. Who we are</h2>
        <p>
          Realscale ("Realscale", "we", "us") provides AI-generated photo enhancement
          services for real estate listings. By using our service, generating a preview,
          or paying for an order, you agree to these Terms.
        </p>

        <h2 className="mt-6 text-xl font-semibold">2. Eligibility</h2>
        <p>
          You may use Realscale if you are a licensed real estate agent, broker, property
          owner, or otherwise have the right to use and modify the photographs you
          submit. By submitting a listing URL or photos, you represent that you have all
          necessary rights and consents to do so.
        </p>

        <h2 className="mt-6 text-xl font-semibold">3. Service description</h2>
        <p>
          Our pipeline produces digitally enhanced versions of MLS photos: virtual
          staging, sky replacement, twilight conversion, and clean-up. <b>Every delivered
          photo is digitally altered.</b> See our{" "}
          <a href="/disclosure" className="text-primary hover:underline">
            Virtual Staging Disclosure
          </a>
          {" "}for details on how we comply with NAR Article 12 / Standard 12-1.
        </p>

        <h2 className="mt-6 text-xl font-semibold">4. Orders and payment</h2>
        <p>
          Orders are placed via Stripe Checkout. Pricing is shown at checkout.
          You authorize us to charge the payment method you provide. We deliver the
          enhanced photo set within the SLA shown for the tier you purchased (typically
          under 2 hours).
        </p>
        <p>
          If we cannot meet the SLA or fewer than 8 photos pass our quality-control gate,
          we will issue an automatic full refund and no enhanced photos will be
          delivered.
        </p>

        <h2 className="mt-6 text-xl font-semibold">5. Refunds</h2>
        <p>
          You may request a refund within 14 days of delivery for any reason. Refunds are
          processed back to the original payment method. After 14 days, refunds are at
          our discretion.
        </p>

        <h2 className="mt-6 text-xl font-semibold">6. Ownership and license</h2>
        <p>
          You retain all rights you have in the source photos you submit. The enhanced
          photos we deliver are yours to use in connection with the listing — including
          MLS, your brokerage's site, social media, and print marketing — for the
          duration the property is on the market and 12 months thereafter. You may not
          re-sell or sub-license the enhanced photos to a third party.
        </p>
        <p>
          You agree we may use anonymized examples of our work (with no recognizable
          address or interior personal effects) for marketing the Realscale service.
        </p>

        <h2 className="mt-6 text-xl font-semibold">7. Acceptable use</h2>
        <p>You will not:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Submit photos you do not have the right to modify.</li>
          <li>Remove or obscure the "Virtually Staged" disclosure on delivered photos.</li>
          <li>Use the service to misrepresent material facts about a property.</li>
          <li>Reverse-engineer or scrape Realscale's pipeline.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">8. Disclaimers</h2>
        <p>
          The service is provided "as is". Enhanced photos are illustrative
          representations of how a property could be furnished or lit. They are not
          renderings of the property's current state. We make no warranty that the
          service will be uninterrupted or error-free.
        </p>

        <h2 className="mt-6 text-xl font-semibold">9. Limitation of liability</h2>
        <p>
          Our aggregate liability under these Terms is limited to the amount you paid
          for the order in question. We are not liable for indirect, incidental, or
          consequential damages.
        </p>

        <h2 className="mt-6 text-xl font-semibold">10. Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of Delaware. Any dispute
          will be brought exclusively in the state or federal courts located in Delaware.
        </p>

        <h2 className="mt-6 text-xl font-semibold">11. Contact</h2>
        <p>
          Questions:{" "}
          <a href="mailto:hello@realscale.app" className="text-primary hover:underline">
            hello@realscale.app
          </a>
        </p>
      </div>
    </div>
  );
}
