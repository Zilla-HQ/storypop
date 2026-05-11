import { notFound } from "next/navigation";
import { CITIES, getCity } from "@/lib/cities";
import { CityPage } from "@/components/marketing/city-page";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  return {
    title: `Virtual Staging ${city.name}, ${city.stateCode} — under 2-hour AI staging | Realscale`,
    description: `AI-powered virtual staging for ${city.name}, ${city.stateCode} listings. Paste a Zillow URL, get every interior photo staged in under 2 hours. NAR-compliant. From $89/listing.`,
    alternates: { canonical: `/virtual-staging/${slug}` },
    openGraph: {
      title: `Virtual Staging ${city.name}, ${city.stateCode} — Realscale`,
      description: `Stage every interior photo on your ${city.name} listing in <2 hours. From $89.`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();
  return <CityPage city={city} serviceId="photo-staging" />;
}
