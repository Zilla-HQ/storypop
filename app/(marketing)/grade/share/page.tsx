import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { parseListingUrl } from "@/lib/listing-url";
import { fetchAirbnbListingDirect } from "@/lib/airbnb-direct";
import { gradeListing, graderInputFromScrape } from "@/lib/grader";
import { Button } from "@/components/ui/button";
import { GraderResultView } from "@/components/marketing/grader-result";

export const dynamic = "force-dynamic";
export const revalidate = 86400; // OG previews can stay cached for a day.

interface PageProps {
  searchParams: Promise<{ u?: string }>;
}

function decodeUrl(encoded: string | undefined): string | null {
  if (!encoded) return null;
  try {
    // base64-url decoded; replace url-safe chars then atob.
    const standard = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    if (!decoded.startsWith("http")) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function loadGrade(encodedUrl: string | undefined) {
  const url = decodeUrl(encodedUrl);
  if (!url) return null;
  const parsed = parseListingUrl(url);
  if (!parsed) return null;
  const scrape = await fetchAirbnbListingDirect(parsed.canonicalUrl);
  if (!scrape) return null;
  const grade = await gradeListing(graderInputFromScrape(scrape));
  return { parsed, scrape, grade };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { u } = await searchParams;
  const data = await loadGrade(u).catch(() => null);
  if (!data) {
    return {
      title: "Restay — Airbnb listing grader",
      description: "Grade any Airbnb listing 0–100 in 10 seconds. Free, no signup.",
    };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency";
  const title = data.scrape.scrapedTitle ?? "Airbnb listing";
  const city = data.scrape.city ?? "";
  const ogParams = new URLSearchParams({
    score: String(data.grade.overall),
    letter: data.grade.letter,
    title,
    city,
  });
  const ogUrl = `${base}/grade-og?${ogParams.toString()}`;

  return {
    title: `${title} graded ${data.grade.letter} (${data.grade.overall}/100) — Restay`,
    description: `${title} scored ${data.grade.overall}/100. ${data.grade.topFixes[0] ?? ""}`,
    openGraph: {
      title: `${title} — graded ${data.grade.letter}`,
      description: `Free Airbnb listing grader. ${data.grade.overall}/100 across photos, copy, signals.`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — graded ${data.grade.letter}`,
      description: `${data.grade.overall}/100 on the Restay grader.`,
      images: [ogUrl],
    },
  };
}

export default async function ShareGradePage({ searchParams }: PageProps) {
  const { u } = await searchParams;
  const data = await loadGrade(u);
  if (!data) notFound();

  // Reuse the existing GraderResultView so this matches the inline result UX.
  const props = {
    sourceId: data.parsed.sourceId,
    canonicalUrl: data.parsed.canonicalUrl,
    listing: {
      title: data.scrape.scrapedTitle,
      city: data.scrape.city,
      state: data.scrape.state,
      photoCount: data.scrape.photos.length,
      thumbnail: data.scrape.photos[0] ?? null,
      reviewCount: data.scrape.reviewCount ?? null,
      avgRating: data.scrape.avgRating ?? null,
      isSuperhost: data.scrape.isSuperhost ?? null,
    },
    grade: data.grade,
  };

  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-10">
        <div className="container max-w-3xl">
          <div className="text-center">
            <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Restay grader · Shared result
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Someone shared their Airbnb listing grade.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Want yours? Free, 10 seconds, no signup.
            </p>
            <div className="mt-6">
              <Link href="/grade">
                <Button size="lg">Grade my own listing →</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-3xl py-12">
        <GraderResultView result={props} />
      </div>
    </>
  );
}
