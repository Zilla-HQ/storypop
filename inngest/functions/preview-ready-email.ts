import { inngest } from "@/inngest/client";
import { db, listings } from "@/db";
import { eq } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { env } from "@/lib/env";

/**
 * Fires when preview.ts finishes generating the first 3 pages and emits
 * `preview/ready`. Sends the parent an email with a preview link.
 *
 * Without this, the form copy at /create — "Your email (so we can send
 * you the preview)" and "I'll email you the preview when it's ready" —
 * was a lie. The preview event was emitted into the void and never
 * picked up.
 */
export const previewReadyEmail = inngest.createFunction(
  { id: "preview-ready-email", name: "StoryPop — email the parent that the preview is ready", retries: 2 },
  { event: "preview/ready" },
  async ({ event, step, logger }) => {
    const { bookId, previewId } = event.data;

    const book = await step.run("load-book", async () => {
      const rows = await db.select().from(listings).where(eq(listings.id, bookId));
      return rows[0] ?? null;
    });
    if (!book) {
      logger.warn({ bookId }, "preview-ready-email: book not found");
      return { skipped: "book-not-found" };
    }

    const to = book.primaryContactEmail as string | null;
    if (!to) {
      logger.warn({ bookId }, "preview-ready-email: no contact email on book");
      return { skipped: "no-email" };
    }

    const childName = (book.childName as string) || "your kid";
    const baseUrl = env("NEXT_PUBLIC_APP_URL", "https://storypop.shop")!;
    const previewUrl = `${baseUrl.replace(/\/$/, "")}/preview/${bookId}`;

    await step.run("send-email", async () => {
      await sendComplianceEmail({
        to,
        fromDomain: env("RESEND_SENDER_DOMAIN", "mail.storypop.shop")!,
        subject: `${childName}'s storybook preview is ready ✨`,
        mjml: mjmlBody({ childName, previewUrl }),
        text: textBody({ childName, previewUrl }),
        listingId: bookId,
        idempotencyKey: `preview-ready-${previewId}`,
        tags: [
          { name: "type", value: "preview_ready" },
          { name: "book_id", value: bookId },
        ],
      });
    });

    return { sentTo: to };
  },
);

function mjmlBody(args: { childName: string; previewUrl: string }): string {
  return `<mjml>
  <mj-body background-color="#FFF8EC">
    <mj-section padding="32px 24px 8px">
      <mj-column>
        <mj-text font-size="28px" font-weight="900" color="#2A2A4A" align="center" line-height="1.2">
          ${escapeHtml(args.childName)}'s storybook is ready to read ✨
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 24px">
      <mj-column>
        <mj-text font-size="16px" line-height="1.55" color="#2A2A4A">
          The first 3 pages are painted and the rest of the 12-page book is written and waiting.
          Click below to see how it turned out:
        </mj-text>
        <mj-button background-color="#FF6B9D" color="#ffffff" font-size="16px" font-weight="700"
                   border-radius="999px" inner-padding="14px 28px"
                   href="${args.previewUrl}">
          See ${escapeHtml(args.childName)}'s book →
        </mj-button>
        <mj-text font-size="13px" color="#6A6A8A" line-height="1.5" padding-top="20px">
          If you love it, pick a format (PDF, softcover, hardcover, or hardcover + plush) and we'll
          finish the rest of the book and deliver it. PDFs land in your inbox in about 5 minutes;
          print books ship in a week.
        </mj-text>
        <mj-text font-size="13px" color="#6A6A8A" line-height="1.5">
          If something looks off — a misspelled name, an illustration that doesn't feel right —
          just reply to this email and we'll fix it.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

function textBody(args: { childName: string; previewUrl: string }): string {
  return [
    `${args.childName}'s storybook preview is ready.`,
    ``,
    `See it: ${args.previewUrl}`,
    ``,
    `The first 3 pages are painted. The rest of the 12-page book is written`,
    `and waiting — pick a format and we'll deliver it (PDF in 5 minutes, print`,
    `books in about a week).`,
    ``,
    `If anything looks off, just reply to this email and we'll fix it.`,
    ``,
    `— The Storypop team`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
