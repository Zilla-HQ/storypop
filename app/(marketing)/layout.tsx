import { Footer } from "@/components/marketing/footer";
import { MetaPixel } from "@/components/marketing/meta-pixel";
import { LaunchBanner } from "@/components/marketing/launch-banner";
import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MetaPixel />
      <LaunchBanner />
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Realscale
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/agents" className="text-muted-foreground hover:text-foreground">
              For agents
            </Link>
            <Link href="/renovate" className="text-muted-foreground hover:text-foreground">
              For homeowners
            </Link>
            <Link href="/services" className="text-muted-foreground hover:text-foreground">
              Services
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
