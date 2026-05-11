import { Footer } from "@/components/marketing/footer";
import { MetaPixel } from "@/components/marketing/meta-pixel";
import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8F0]">
      <MetaPixel />
      <header className="border-b border-slate-200/60 bg-[#FFF8F0]">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            StoryPop
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/create" className="font-medium text-[#FF6B9D] hover:underline">
              Make a book
            </Link>
            <Link href="/samples" className="text-slate-600 hover:text-slate-900">
              Samples
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
