import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/outreach", label: "Outreach" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/postcards", label: "Postcards" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-muted/20">
        <div className="p-6">
          <div className="text-lg font-bold tracking-tight">Realscale</div>
          <div className="text-xs text-muted-foreground">Admin</div>
        </div>
        <nav className="px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-14 items-center justify-end border-b px-6">
          <UserButton afterSignOutUrl="/" />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
