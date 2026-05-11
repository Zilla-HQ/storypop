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
  if (!c) return { title: "Comparison — Sitebeat" };
  return {
    title: `Sitebeat vs ${c.name} — feature + pricing comparison`,
    description: `${c.name} starts at ${c.pricing}. Sitebeat is $29/mo. Side-by-side comparison of features, pricing, and the right fit for your team.`,
    alternates: { canonical: `/vs/${c.slug}` },
  };
}

export default async function VsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) notFound();
  return <CompetitorPage competitor={c} variant="vs" />;
}
