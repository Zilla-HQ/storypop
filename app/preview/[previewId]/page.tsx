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

  // Sign R2 URLs for the visible pages (1-3) AND pair them with their
  // story body text. Earlier we only passed the URL — the customer saw
  // 3 images of a kid with no story text and couldn't read what the
  // book actually says. Pass body text + an excerpt of the next-page
  // body so they get a real taste of the writing.
  const storyPages = preview?.payload.story.pages ?? [];
  const signedPages = ready
    ? await Promise.all(
        preview.payload.previewPages
          .slice(0, 3)
          .map(async (p) => ({
            pageNumber: p.pageNumber,
            url: await signedR2Url(p.r2Key, 60 * 60),
            body: storyPages[p.pageNumber]?.body ?? "",
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
      dedication={preview?.payload.story.dedication ?? null}
      pages={signedPages}
      // First snippet of one locked page — tease so the customer sees
      // the writing voice continues past the unlocked previews.
      nextPageTeaser={storyPages[3]?.body ?? null}
      lockedPageCount={
        ready ? Math.max(0, preview.payload.story.pages.length - signedPages.length) : 13
      }
      customerEmail={book.primaryContactEmail ?? ""}
    />
  );
}
