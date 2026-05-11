export const metadata = { title: "Virtual Staging Disclosure — Realscale" };

export default function DisclosurePage() {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="text-3xl font-bold tracking-tight">Virtual Staging Disclosure</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>

      <div className="prose prose-slate mt-8 max-w-none space-y-4 text-[15px] leading-7">
        <p>
          Realscale generates AI-enhanced versions of real estate listing photos. Every
          photo we return as part of an order is digitally altered. We follow the National
          Association of Realtors' (NAR) Code of Ethics, Article 12, and the related
          Standard of Practice 12-1, which require that any photographic representation
          of a property be a "true picture" — and that any digitally enhanced photograph
          be clearly disclosed as such.
        </p>

        <h2 className="mt-8 text-xl font-semibold">How we comply</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <b>Visible watermark on every staged photo.</b> Each enhanced photo we deliver
            is stamped with the text <b>"Virtually Staged"</b> in a corner overlay. This
            stamp is non-removable in the file we provide.
          </li>
          <li>
            <b>Architectural integrity preserved.</b> Our pipeline keeps walls, windows,
            floors, fixtures, and structural elements identical to the source photo. We
            add furniture, decor, and lighting only.
          </li>
          <li>
            <b>Sky replacement and twilight conversion</b> on exterior shots are flagged
            with the same "Virtually Staged" disclosure.
          </li>
          <li>
            <b>Quality control gate.</b> Every output is automatically reviewed for
            artifacts (distorted geometry, melting furniture, duplicate objects). Photos
            that fail the QC threshold are excluded from delivery.
          </li>
          <li>
            <b>Original photos retained.</b> We store the source photos for 30 days after
            delivery so the listing agent or seller can produce them on request to a
            buyer or buyer's agent.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Recommended disclosure text</h2>
        <p>
          When listing photos generated through Realscale on the MLS or in marketing
          materials, we recommend including the following statement in the listing
          remarks:
        </p>
        <blockquote className="my-4 rounded-md border-l-4 border-emerald-500 bg-emerald-50 p-4 italic">
          "Some interior photos have been virtually staged for illustration purposes
          only. Staging is digital; furniture and decor depicted are not included with
          the property. Original photos available on request."
        </blockquote>

        <h2 className="mt-8 text-xl font-semibold">If a buyer or another agent asks</h2>
        <p>
          You may forward our disclosure URL —
          <a href="https://realscale.app/disclosure" className="text-primary hover:underline">
            {" "}https://realscale.app/disclosure
          </a>{" "}
          — or attach the original (un-staged) photo, which we retain at the listing
          agent's request for 30 days post-delivery.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Questions</h2>
        <p>
          Email{" "}
          <a href="mailto:hello@realscale.app" className="text-primary hover:underline">
            hello@realscale.app
          </a>{" "}
          with the listing address and we'll respond with original-source documentation
          within 24 hours.
        </p>
      </div>
    </div>
  );
}
