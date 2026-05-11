import Link from "next/link";

export function Footer() {
  const businessName = process.env.BUSINESS_NAME ?? "Realscale";
  const address = process.env.BUSINESS_ADDRESS ?? "";
  return (
    <footer className="border-t bg-muted/30 py-10">
      <div className="container flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs">
            © {new Date().getFullYear()} {businessName}. All rights reserved.
          </div>
          {address && <div className="text-xs">{address}</div>}
        </div>
        <nav className="flex flex-wrap gap-4 text-xs">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/disclosure" className="hover:text-foreground">
            Staging disclosure
          </Link>
        </nav>
      </div>
    </footer>
  );
}
