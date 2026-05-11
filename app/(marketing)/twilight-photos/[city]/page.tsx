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
    title: `Twilight Real Estate Photos ${city.name}, ${city.stateCode} — <2hr Delivery | Realscale`,
    description: `Convert daytime ${city.name} exteriors into cinematic twilight shots in under 2 hours. Sky replacement, warm window glow. From $49/photo.`,
    alternates: { canonical: `/twilight-photos/${slug}` },
    openGraph: {
      title: `Twilight Photos ${city.name}, ${city.stateCode} — Realscale`,
      description: `Cinematic twilight exteriors on your ${city.name} listing in <2 hours.`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();
  return <CityPage city={city} serviceId="twilight-exterior" />;
}
