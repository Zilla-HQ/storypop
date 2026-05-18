"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  bookId: string;
  childName: string;
  childAge: number;
  archetype: string;
  ready: boolean;
  title: string | null;
  dedication: string | null;
  pages: { pageNumber: number; url: string; body: string }[];
  nextPageTeaser: string | null;
  lockedPageCount: number;
  customerEmail: string;
}

const SKUS = [
  { id: "pdf", name: "Instant PDF", price: "$14.99", desc: "Email in 5 min" },
  { id: "softcover", name: "Softcover", price: "$29.99", desc: "5–8 days" },
  { id: "hardcover", name: "Hardcover", price: "$44.99", desc: "7–10 days" },
  { id: "gift-bundle", name: "Bundle + plush", price: "$69.99", desc: "10–14 days" },
] as const;

type SkuId = (typeof SKUS)[number]["id"];

export default function PreviewClient(props: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(props.customerEmail);
  const [selected, setSelected] = useState<SkuId>("hardcover");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If preview not ready, poll the route every 5s and re-fetch.
  useEffect(() => {
    if (props.ready) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [props.ready, router]);

  async function startCheckout() {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        bookId: props.bookId,
        serviceId: selected,
        customerEmail: email,
      };
      // Print SKUs require shipping. Stripe Checkout collects the address.
      // We POST a minimal payload; for print SKUs we set a placeholder
      // shipping object so the API doesn't reject (real address comes
      // through the Stripe webhook).
      if (selected !== "pdf") {
        body.shipping = {
          name: "Placeholder — collected at checkout",
          street1: "—",
          city: "—",
          stateCode: "NA",
          postcode: "00000",
          countryCode: "US",
        };
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!data.url) {
        setError(data.error ?? "Checkout failed");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  if (!props.ready) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Drawing {props.childName}&apos;s book…
        </h1>
        <p className="mt-4 text-muted-foreground">
          This takes about 5 minutes. You can leave the page open or close it —
          I&apos;ll email {props.customerEmail || "you"} the preview when it&apos;s ready.
        </p>
        <div className="mt-8 inline-block h-3 w-32 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse bg-[#FF6B9D]" />
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-6 py-16">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[#FF6B9D]">
          Preview ready
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {props.title ?? `${props.childName}'s Book`}
        </h1>
        <p className="mt-3 text-muted-foreground">
          For {props.childName}, age {props.childAge} · {props.archetype}
        </p>
      </header>

      {props.dedication && (
        <p className="mt-4 text-center italic text-slate-600">
          &ldquo;{props.dedication}&rdquo;
        </p>
      )}

      {/* Spread layout: image left, page text right (alternates on mobile).
          Bigger images, real story text — the customer is judging the writing
          AND the art, so show both. */}
      <section className="mt-10 space-y-6">
        {props.pages.map((p, idx) => (
          <figure
            key={p.pageNumber}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm md:flex ${
              idx % 2 === 1 ? "md:flex-row-reverse" : ""
            }`}
          >
            <img
              src={p.url}
              alt={`Page ${p.pageNumber + 1}`}
              className="aspect-square w-full md:w-1/2"
            />
            <figcaption className="flex flex-col justify-center gap-3 p-6 md:w-1/2 md:p-10">
              <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B9D]">
                Page {p.pageNumber + 1}
                <span className="ml-2 font-normal text-slate-400">
                  of {props.pages.length + props.lockedPageCount}
                </span>
              </div>
              <p className="text-lg leading-relaxed text-slate-900 sm:text-xl">
                {p.body}
              </p>
            </figcaption>
          </figure>
        ))}
      </section>

      {/* Teaser of page 4 — a blurred sneak so the customer feels what's
          on the other side of the paywall. Drives the buy CTA below. */}
      {props.lockedPageCount > 0 && (
        <section className="relative mt-8 overflow-hidden rounded-2xl border-2 border-dashed border-[#FF6B9D]/40 bg-white p-8">
          {props.nextPageTeaser && (
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B9D]">
                Page {props.pages.length + 1} · locked
              </div>
              <p className="mt-3 select-none text-lg italic leading-relaxed text-slate-900 blur-[6px]">
                {props.nextPageTeaser}
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FF6B9D] px-5 py-2 text-sm font-bold text-white">
              🔒 +{props.lockedPageCount} more pages waiting
            </span>
            <p className="mt-3 text-sm text-slate-500">
              Pick a format below — we deliver the rest immediately.
            </p>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900">Pick a format</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {SKUS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              className={`rounded-2xl border p-5 text-left transition ${
                selected === s.id
                  ? "border-[#FF6B9D] bg-[#FFD166]/20"
                  : "border-slate-200 bg-white hover:border-[#FF6B9D]"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{s.name}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{s.price}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button
            type="button"
            disabled={!email || submitting}
            onClick={startCheckout}
            className="w-full bg-[#FF6B9D] py-6 text-base text-white hover:bg-[#e8588a]"
          >
            {submitting ? "Starting…" : `Get the book — ${SKUS.find((s) => s.id === selected)?.price}`}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      <footer className="mt-16 text-center text-xs text-muted-foreground">
        Your kid&apos;s photo (if uploaded) auto-purges 30 days after order.
      </footer>
    </main>
  );
}
