import Link from "next/link";
import type { BlogSection as BlogSectionType } from "@/lib/blog-catalog";

export function BlogSection({ section }: { section: BlogSectionType }) {
  switch (section.type) {
    case "p":
      return (
        <p className="text-base leading-relaxed text-foreground/90">
          {section.text}
        </p>
      );
    case "h2":
      return (
        <h2 className="mt-10 text-2xl font-bold tracking-tight">
          {section.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-6 text-lg font-semibold tracking-tight">
          {section.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="ml-5 list-disc space-y-2 text-base text-foreground/90">
          {section.items?.map((it, i) => (
            <li key={i} className="leading-relaxed">
              {it}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="ml-5 list-decimal space-y-2 text-base text-foreground/90">
          {section.items?.map((it, i) => (
            <li key={i} className="leading-relaxed">
              {it}
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-emerald-500 bg-muted/30 px-5 py-3 text-base italic text-muted-foreground">
          {section.text}
        </blockquote>
      );
    case "callout":
      return (
        <aside className="mt-10 rounded-xl border bg-emerald-50 p-8 text-center">
          <p className="text-base font-medium">{section.text}</p>
          {section.href && section.cta ? (
            <Link
              href={section.href}
              className="mt-5 inline-block rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {section.cta}
            </Link>
          ) : null}
        </aside>
      );
  }
}
