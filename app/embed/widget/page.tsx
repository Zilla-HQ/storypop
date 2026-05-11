import type { Metadata } from "next";
import { EmbedAuditForm } from "@/components/embed-audit-form";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Free SEO Audit",
  description: "Run a free 13-point SEO audit in 30 seconds.",
  robots: { index: false, follow: false },
};

/**
 * Embeddable iframe widget. Lives at /embed/widget so partners can drop
 * an `<iframe src="https://sitebeat.tech/embed/widget" />` on their site
 * and get a free SEO audit lead-capture form. Submissions land in our
 * normal /api/audit pipeline; the audit results page opens in a new tab
 * via the form's router.push (which is in the iframe — partners should
 * set `target="_blank"` semantics by linking out from the widget).
 *
 * Visual: minimal, no marketing nav/footer chrome, no Sitebeat
 * branding above-the-fold so it feels native to the embedder. We do
 * include a small "powered by Sitebeat" so users know where the
 * report is coming from once they submit.
 */
export default function EmbedWidget() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-bold tracking-tight">
          Free SEO audit
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop your URL — get a graded report in 30 seconds.
        </p>
        <div className="mt-5">
          <EmbedAuditForm />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://sitebeat.tech?utm_source=embed_widget&utm_medium=referral"
            target="_blank"
            rel="noopener"
            className="font-semibold underline"
          >
            Sitebeat
          </a>
        </p>
      </div>
    </div>
  );
}
