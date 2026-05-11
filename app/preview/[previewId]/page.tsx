import { notFound } from "next/navigation";
import { db, listings, previews } from "@/db";
import { eq, desc } from "drizzle-orm";
import { signedR2Url } from "@/lib/r2";
import PreviewClient from "./preview-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ previewId: string }>;
}

export default async function PreviewPage({ params }: PageProps) {
  // `previewId` here is the bookId — the URL the /create flow redirects
  // to. We look up the most-recent preview row by book to keep the URL
  // stable across re-renders.
  const { previewId: bookId } = await params;

  const [book] = await db.select().from(listings).where(eq(listings.id, bookId)).limit(1);
  if (!book) notFound();

  const [preview] = await db
    .select()
    .from(previews)
    .where(eq(previews.listingId, bookId))
    .orderBy(desc(previews.createdAt))
    .limit(1);

  // If the preview hasn't finished generating yet, show the polling state.
  const ready = Boolean(preview);

  // Sign R2 URLs for the visible pages (1-3) so the client can render them.
  const signedPages = ready
    ? await Promise.all(
        preview.payload.previewPages
          .slice(0, 3)
          .map(async (p) => ({
            pageNumber: p.pageNumber,
            url: await signedR2Url(p.r2Key, 60 * 60),
          })),
      )
    : [];

  return (
    <PreviewClient
      bookId={book.id}
      childName={book.childName}
      childAge={book.childAge}
      archetype={book.archetype}
      ready={ready}
      title={preview?.payload.story.title ?? null}
      pages={signedPages}
      lockedPageCount={
        ready ? Math.max(0, preview.payload.story.pages.length - signedPages.length) : 13
      }
      customerEmail={book.primaryContactEmail ?? ""}
    />
  );
}
