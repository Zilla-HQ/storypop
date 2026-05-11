import { notFound } from "next/navigation";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { GeneratingClient } from "./client";
import { getSampleBeforeAfters } from "@/lib/samples";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GeneratingPage({ params }: PageProps) {
  const { id } = await params;
  const [listing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!listing) notFound();
  const samples = await getSampleBeforeAfters("agents");
  return <GeneratingClient id={id} samples={samples} />;
}
