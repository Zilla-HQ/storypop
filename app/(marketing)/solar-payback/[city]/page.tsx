import { notFound } from "next/navigation";
import { citiesForService, getCity } from "@/lib/cities";
import { CityPage } from "@/components/marketing/city-page";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return citiesForService("solar-mockup").map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  return {
    title: `Solar Panels ${city.name}, ${city.stateCode} — Free Mockup + 25-yr Savings | Realscale`,
    description: `See solar rendered onto a satellite view of your ${city.name} roof. Free mockup, lifetime savings estimate, vetted local installers. No signup.`,
    alternates: { canonical: `/solar-payback/${slug}` },
    openGraph: {
      title: `Solar Mockup for ${city.name} Homeowners — Realscale`,
      description: `Free solar mockup + 25-year savings calc for your ${city.name} home.`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city || !city.solarFeasible) notFound();
  return <CityPage city={city} serviceId="solar-mockup" />;
}
