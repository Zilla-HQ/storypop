import { notFound } from "next/navigation";
import Link from "next/link";
import { db, listings, orders } from "@/db";
import { eq } from "drizzle-orm";
import { signedR2Url } from "@/lib/r2";

/**
 * Post-purchase landing.
 *
 * Stripe's `success_url` from /api/checkout redirects buyers here. The
 * fulfillment Inngest function (orders/paid event) runs in the background
 * and takes ~3 min to assemble the PDF. We render a polling-friendly
 * status page that auto-refreshes until the PDF is ready.
 *
 * No critical state lives in the query string — the email always carries
 * the download link as the fallback delivery channel.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DeliveryPage({ params }: PageProps) {
  const { orderId } = await params;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) notFound();

  const [book] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, order.listingId as string))
    .limit(1);
  if (!book) notFound();

  const isPaid = order.status === "paid" || order.status === "fulfilled";
  const finalPdfKey = book.finalPdfUrl as string | null;
  // We only sign the R2 URL when the PDF actually exists. Until then the
  // page shows the "your book is being made" state and refreshes itself.
  const pdfUrl = isPaid && finalPdfKey ? await signedR2Url(finalPdfKey, 60 * 60 * 24 * 7) : null;
  const isFulfilled = Boolean(pdfUrl);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* If the PDF isn't ready yet, ask the browser to revisit every 5s.
          Cheap to do as a meta-refresh — no JS required, survives a tab
          close + reopen, and degrades gracefully on slow connections. */}
      {!isFulfilled && (
        <meta httpEquiv="refresh" content="5" />
      )}

      <header className="mb-10 text-center">
        <Link href="/" className="text-2xl font-black text-[#FF6B9D]">
          Storypop
        </Link>
      </header>

      {isFulfilled ? (
        <section className="rounded-2xl bg-emerald-50 p-8 text-center">
          <div className="mb-2 text-5xl">🎉</div>
          <h1 className="mb-2 text-2xl font-black text-slate-900">
            {book.childName as string}&apos;s book is ready
          </h1>
          <p className="mb-6 text-slate-700">
            We just emailed you a copy too — bookmark this page so you can come back.
          </p>
          <a
            href={pdfUrl!}
            target="_blank"
            rel="noopener"
            className="inline-block rounded-full bg-[#FF6B9D] px-8 py-3 font-bold text-white shadow hover:bg-[#e85a8a]"
          >
            Download the PDF
          </a>
        </section>
      ) : (
        <section className="rounded-2xl bg-amber-50 p-8 text-center">
          <div className="mb-2 text-5xl">✨</div>
          <h1 className="mb-2 text-2xl font-black text-slate-900">
            Payment confirmed — making {book.childName as string}&apos;s book
          </h1>
          <p className="mb-2 text-slate-700">
            We&apos;re painting all 12 illustrations and assembling the PDF. This takes about 3 minutes.
          </p>
          <p className="text-sm text-slate-500">
            You can close this tab — your PDF will land in your inbox at{" "}
            <strong>{(order.customerEmail as string | null) ?? "your email"}</strong> as soon as
            it&apos;s done.
          </p>
          <div className="mt-6 text-xs text-slate-400">
            Auto-refreshing every 5 seconds...
          </div>
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-slate-400">
        Order ID: {order.id} · Questions? hello@storypop.shop
      </footer>
    </main>
  );
}
