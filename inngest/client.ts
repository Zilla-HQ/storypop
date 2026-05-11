import { EventSchemas, Inngest } from "inngest";

type Events = {
  // ─── B2C book flow ────────────────────────────────────────────────────────
  /** Parent submitted the /create form. */
  "book-request/created": { data: { bookId: string } };
  /** Form passed validation + clarity gate. */
  "book/qualified": { data: { bookId: string } };
  /** Free preview pages (1-3) rendered and persisted. */
  "preview/ready": { data: { bookId: string; previewId: string } };

  // ─── orders + fulfillment ─────────────────────────────────────────────────
  "orders/paid": { data: { orderId: string } };
  "orders/fulfilled": { data: { orderId: string } };
  "orders/fulfillment_failed": { data: { orderId: string; reason: string } };
  "orders/auto_refunded": { data: { orderId: string; reason: string } };

  // ─── Lulu print tracking ──────────────────────────────────────────────────
  "print-job/submitted": { data: { orderId: string; luluJobId: string } };
  "print-job/shipped": {
    data: { orderId: string; trackingNumber: string; trackingUrl?: string };
  };
  "print-job/delivered": { data: { orderId: string } };

  // ─── compliance crons ─────────────────────────────────────────────────────
  /** Daily photo-purge cron — deletes uploaded child photos older than retention window. */
  "photo/purged": { data: { listingId: string; photoUrl: string } };

  // ─── abandoned-cart + transactional inbound ───────────────────────────────
  "abandoned-cart/run": { data: Record<string, never> };
  "inbound/email": {
    data: {
      from: string;
      to: string;
      subject: string | null;
      text: string | null;
      html: string | null;
      messageId: string | null;
      inReplyTo: string | null;
    };
  };
};

export const inngest = new Inngest({
  id: "storypop",
  schemas: new EventSchemas().fromRecord<Events>(),
});
