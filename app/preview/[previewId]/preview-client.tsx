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
  pronouns: string | null;
  description: string | null;
  favorites: string | null;
  hasPhoto: boolean;
  ready: boolean;
  title: string | null;
  dedication: string | null;
  pages: { pageNumber: number; url: string; body: string }[];
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
          {props.childName}&apos;s book is on the way
        </h1>
        <p className="mt-4 text-muted-foreground">
          Your preview link will land in{" "}
          <span className="font-medium text-slate-900">
            {props.customerEmail || "your inbox"}
          </span>{" "}
          in about 5–10 minutes. Feel free to close this page — we&apos;ll deliver it
          straight to your inbox, so keep an eye out there.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Tip: if you don&apos;t see it, check your spam folder.
        </p>
      </main>
    );
  }

  // Build the "what we used" pill row. Each chip is a visible signal that
  // the story was generated from THIS family's inputs, not a stock template.
  const inputChips: { label: string; tone: "name" | "fact" | "interest" | "photo" }[] = [];
  inputChips.push({ label: props.childName, tone: "name" });
  inputChips.push({ label: `age ${props.childAge}`, tone: "fact" });
  if (props.pronouns) inputChips.push({ label: props.pronouns, tone: "fact" });
  inputChips.push({ label: props.archetype, tone: "fact" });
  if (props.favorites) {
    // Split on common separators; keep each token as its own chip up to 4.
    props.favorites
      .split(/[,;]| and /i)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4)
      .forEach((f) => inputChips.push({ label: f, tone: "interest" }));
  } else if (props.description) {
    // Fall back to a compressed description chip so the row never looks bare.
    inputChips.push({ label: truncate(props.description, 40), tone: "interest" });
  }
  if (props.hasPhoto) inputChips.push({ label: "your photo ✓", tone: "photo" });

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
        {props.dedication && (
          <p className="mx-auto mt-4 max-w-xl text-base italic text-slate-700">
            &ldquo;{props.dedication}&rdquo;
          </p>
        )}

        {/* Personalization receipt — proves the story was built from THIS
            family's inputs. Shown as colored chips so it scans in <1s. */}
        <div className="mx-auto mt-6 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Personalized from your inputs
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {inputChips.map((c, i) => (
              <span
                key={i}
                className={`rounded-full px-3 py-1 text-xs font-medium ${chipClass(c.tone)}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
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
            <figcaption className="space-y-2 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FF6B9D]">
                Page {p.pageNumber + 1} of {props.pages.length + props.lockedPageCount}
              </p>
              {p.body && (
                <p className="text-sm leading-snug text-slate-700">
                  {highlightName(p.body, props.childName)}
                </p>
              )}
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
            Pick a format below to see the rest of {props.childName}&apos;s story.
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

function chipClass(tone: "name" | "fact" | "interest" | "photo"): string {
  switch (tone) {
    case "name":
      return "bg-[#FF6B9D] text-white";
    case "interest":
      return "bg-[#FFD166]/40 text-slate-900";
    case "photo":
      return "bg-emerald-100 text-emerald-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Bold every occurrence of the child's name in the page body so the
// personalization is impossible to miss at a glance.
function highlightName(body: string, name: string): React.ReactNode {
  if (!name) return body;
  const parts = body.split(new RegExp(`(${escapeRegex(name)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === name.toLowerCase() ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
