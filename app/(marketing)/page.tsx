import Link from "next/link";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-5xl px-6 py-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[#FF6B9D]">
          StoryPop
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          A book where your kid is the hero.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Give us a first name, an age, and a story idea. Optionally upload a
          photo. In about five minutes Pip writes and illustrates a personalized
          16-page picture book starring your kid. PDF, softcover, or hardcover.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF6B9D] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#FF6B9D]/30 transition hover:bg-[#e8588a]"
          >
            <Sparkles className="h-5 w-5" />
            Make their book
          </Link>
          <Link
            href="/samples"
            className="text-base font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            See samples
          </Link>
        </div>
      </header>

      <section className="mt-24 grid gap-12 sm:grid-cols-3">
        <Step
          number="1"
          title="Tell us about your kid"
          body="Name, age, pronouns, and the kind of story you want — bedtime, adventure, first day of school, new sibling, lost tooth, birthday."
        />
        <Step
          number="2"
          title="Optional: upload a photo"
          body="If you upload one, Pip locks the character to your kid's features across every page. If you don't, Pip picks a default character that matches their age."
        />
        <Step
          number="3"
          title="Preview free"
          body="In about 5 minutes you see the first 3 pages free. If you love it, choose a format and we deliver the rest."
        />
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-4">
        <Tier name="Instant PDF" price="$14.99" desc="In your email in 5 minutes." />
        <Tier name="Softcover" price="$29.99" desc="Printed, 5–8 days." />
        <Tier name="Hardcover" price="$44.99" desc="Cloth-bound, 7–10 days." />
        <Tier
          name="Gift bundle"
          price="$69.99"
          desc="Hardcover + matching plush."
        />
      </section>

      <footer className="mt-24 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>
          StoryPop is a tool for parents and guardians. We never market to
          children. Uploaded photos auto-purge after 30 days. See our{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD166] font-bold text-slate-900">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}

function Tier({ name, price, desc }: { name: string; price: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-[#FFF8F0] p-6">
      <p className="text-sm font-medium text-slate-500">{name}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{price}</p>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
