import { inngest } from "@/inngest/client";
import { db, listings, previews } from "@/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "@/lib/r2";
import { trackAgentCost, getTodaySpendCents } from "@/lib/costs";
import { trackEvent } from "@/lib/posthog";
import {
  lockCharacter,
  generatePageIllustration,
  ContentSafetyError,
  type StylePreset,
} from "@/lib/falai";
import { draftStory } from "@/lib/claude";

/**
 * StoryPop preview generation. Takes a book request (childName, age,
 * pronouns, archetype, optional photo) and produces:
 *
 *   1. A LoRA character lock (3-shot training off the uploaded photo, or
 *      a deterministic default keyed on age + hints).
 *   2. A Claude-drafted 12–16 page story passed through the safety gate.
 *   3. The first 3 page illustrations (the free preview).
 *
 * The remaining pages are generated post-payment by `fulfillment.ts`.
 *
 * Cost cap: $1.50 per preview (LoRA ~$0.18, story ~$0.02, 3 pages × $0.04).
 * The fulfillment-time generation of the remaining ~13 pages costs ~$0.52,
 * landing per-book total marginal cost around $1.04.
 *
 * `listings` is the merchant-template table name; for StoryPop the row
 * stores a book request.
 */

const MAX_PREVIEW_COST_CENTS = 150;
const FREE_PREVIEW_PAGES = 3;

export const generatePreview = inngest.createFunction(
  { id: "preview-generate", name: "StoryPop — generate book preview" },
  { event: "book-request/created" },
  async ({ event, step, logger }) => {
    const { bookId } = event.data;

    const book = await step.run("load-book", async () => {
      const rows = await db.select().from(listings).where(eq(listings.id, bookId));
      return rows[0] ?? null;
    });
    if (!book) {
      logger.warn({ bookId }, "preview: book not found");
      return { skipped: "book-not-found" };
    }

    const todaySpend = await step.run("budget-check", () => getTodaySpendCents("preview"));
    if (todaySpend > 10_000) {
      // Daily safety cap from MERCHANT.md §8 — pause new gens, alert operator.
      return { skipped: "daily-budget-exceeded" };
    }

    // ─── 1. Character lock ────────────────────────────────────────────────
    const character = await step.run("lock-character", () =>
      lockCharacter({
        photoUrl: book.photoUrl as string | null,
        childAge: book.childAge as number,
        pronouns: book.pronouns as string | null,
        defaultHints: (book.defaultCharacterHints as never) ?? null,
      }),
    );

    // ─── 2. Draft the story ──────────────────────────────────────────────
    const story = await step.run("draft-story", () =>
      draftStory({
        childName: book.childName as string,
        childAge: book.childAge as number,
        pronouns: (book.pronouns as string) ?? "they/them",
        archetype: book.archetype as string,
      }),
    );

    // Persist the story now so the preview page can render text even while
    // illustrations are still rendering.
    await step.run("persist-story", async () => {
      await db
        .update(listings)
        .set({ story, loraId: character.loraId, updatedAt: new Date() })
        .where(eq(listings.id, bookId));
    });

    // ─── 3. Generate the free-tier illustrations (cover + first 3 pages) ──
    const stylePreset: StylePreset = (book.stylePreset as StylePreset) ?? "picture-book-warm";

    const previewPages: { pageNumber: number; r2Key: string; flagged: boolean }[] = [];
    for (let i = 0; i < FREE_PREVIEW_PAGES; i++) {
      const page = story.pages[i];
      if (!page) break;
      try {
        const result = await step.run(`gen-page-${i}`, () =>
          generatePageIllustration({
            loraId: character.loraId,
            isDefaultLora: character.isDefault,
            sceneDescription: page.sceneDescription,
            stylePreset,
            pageNumber: i,
            childName: book.childName as string,
          }),
        );
        const r2Key = `books/${bookId}/pages/${i}.png`;
        await step.run(`upload-page-${i}`, async () => {
          const res = await fetch(result.imageUrl);
          const buf = Buffer.from(await res.arrayBuffer());
          await uploadToR2(r2Key, buf, "image/png");
        });
        previewPages.push({ pageNumber: i, r2Key, flagged: result.flagged });
      } catch (err) {
        if (err instanceof ContentSafetyError) {
          logger.error({ bookId, pageNumber: i, err: err.message }, "safety gate blocked page");
          return { error: "content-safety-blocked", pageNumber: i };
        }
        throw err;
      }
    }

    const previewId = await step.run("persist-preview", async () => {
      const inserted = await db
        .insert(previews)
        .values({
          listingId: bookId,
          payload: { previewPages, story, stylePreset },
          createdAt: new Date(),
        })
        .returning({ id: previews.id });
      return inserted[0]?.id;
    });

    await step.run("track-cost", () =>
      trackAgentCost("preview", character.estCostCents + 2 + FREE_PREVIEW_PAGES * 4),
    );
    await step.run("track-event", () =>
      trackEvent({
        distinctId: bookId,
        event: "preview_ready",
        properties: { bookId, previewId, pages: previewPages.length },
      }),
    );
    await step.sendEvent("emit-ready", {
      name: "preview/ready",
      data: { bookId, previewId },
    });

    return { previewId, pagesGenerated: previewPages.length };
  },
);
