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
    title: `Curb Appeal Ideas ${city.name}, ${city.stateCode} — Free AI Mockup | Realscale`,
    description: `Render a refreshed front yard onto a real satellite view of your ${city.name} home. Free mockup, contractor intros, no signup.`,
    alternates: { canonical: `/curb-appeal/${slug}` },
    openGraph: {
      title: `Curb Appeal Mockup for ${city.name} Homeowners — Realscale`,
      description: `Free curb-appeal refresh rendered on your real ${city.name} property.`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();
  return <CityPage city={city} serviceId="curb-appeal" />;
}
