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
  pages: { pageNumber: number; url: string }[];
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

      <section className="mt-12 grid gap-6 sm:grid-cols-3">
        {props.pages.map((p) => (
          <figure
            key={p.pageNumber}
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          >
            <img
              src={p.url}
              alt={`Page ${p.pageNumber + 1}`}
              className="aspect-square w-full object-cover"
            />
            <figcaption className="px-3 py-2 text-xs text-muted-foreground">
              Page {p.pageNumber + 1} of {props.pages.length + props.lockedPageCount}
            </figcaption>
          </figure>
        ))}
      </section>

      {props.lockedPageCount > 0 && (
        <section className="mt-8 rounded-2xl border-2 border-dashed border-[#FF6B9D]/40 bg-white p-6 text-center">
          <p className="text-lg font-semibold text-slate-900">
            +{props.lockedPageCount} more pages waiting
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a format below to see the rest.
          </p>
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
