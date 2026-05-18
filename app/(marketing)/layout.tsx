import { Footer } from "@/components/marketing/footer";
import { MetaPixel } from "@/components/marketing/meta-pixel";

/**
 * Marketing layout — no chrome.
 *
 * The landing page (app/(marketing)/page.tsx) renders its own nav/footer
 * to match storypop.shop's design. Other marketing routes (/create,
 * /samples, /preview) drop into this layout but render their own headers
 * too. We just wrap with the brand-cream background + the Meta Pixel
 * tag + the legal-footer component.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <MetaPixel />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
