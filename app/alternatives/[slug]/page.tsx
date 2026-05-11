import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitorPage } from "@/components/competitor-page";
import { COMPETITORS, getCompetitor } from "@/lib/competitors-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) return { title: "Alternatives — Sitebeat" };
  return {
    title: `Best ${c.name} alternatives — Sitebeat`,
    description: `Looking for a cheaper ${c.name} alternative? Sitebeat covers SEO site audits + weekly monitoring at $29/mo. ${c.name} starts at ${c.pricing}.`,
    alternates: { canonical: `/alternatives/${c.slug}` },
  };
}

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) notFound();
  return <CompetitorPage competitor={c} variant="alternatives" />;
}
