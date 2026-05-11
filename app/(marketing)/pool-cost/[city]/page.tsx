import { notFound } from "next/navigation";
import { citiesForService, getCity } from "@/lib/cities";
import { CityPage } from "@/components/marketing/city-page";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return citiesForService("pool-mockup").map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  return {
    title: `Pool Cost ${city.name}, ${city.stateCode} — Free Mockup on Your Real Backyard | Realscale`,
    description: `See an in-ground pool rendered onto a real satellite view of your ${city.name} home. Free mockup, build cost estimate, vetted local installers. No signup.`,
    alternates: { canonical: `/pool-cost/${slug}` },
    openGraph: {
      title: `Pool Mockup for ${city.name} Homeowners — Realscale`,
      description: `Free in-ground pool mockup on a real satellite tile of your ${city.name} backyard.`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city || !city.poolFeasible) notFound();
  return <CityPage city={city} serviceId="pool-mockup" />;
}
