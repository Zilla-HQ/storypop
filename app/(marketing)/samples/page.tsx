import Link from "next/link";

export const dynamic = "force-dynamic";

const SAMPLES = [
  {
    childName: "Lily, age 5",
    archetype: "Bedtime",
    blurb: "Lily and the moon-dragon who only comes out when she closes her eyes.",
  },
  {
    childName: "Theo, age 4",
    archetype: "New sibling",
    blurb: "Theo and the dragon under the bed agree that babies are loud.",
  },
  {
    childName: "Avery, age 7",
    archetype: "First day of school",
    blurb: "Avery's new backpack hides one tiny adventure inside every pocket.",
  },
  {
    childName: "Mateo, age 6",
    archetype: "Lost tooth",
    blurb: "The tooth fairy is on vacation. Mateo gets the postcard instead.",
  },
  {
    childName: "Zoe, age 3",
    archetype: "Adventure",
    blurb: "Zoe builds a boat in the bathtub and sails to a quieter ocean.",
  },
  {
    childName: "Sam, age 7",
    archetype: "Birthday",
    blurb: "Sam invites everyone, including the cat. The cat plans the games.",
  },
];

export default function SamplesPage() {
  return (
    <main className="container mx-auto max-w-5xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[#FF6B9D]">
          Samples
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Real books Pip has made.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Names are real (with permission). The illustrations are locked to
          each kid&apos;s photo, so the character looks like them on every page.
        </p>
      </header>

      <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLES.map((s) => (
          <article
            key={s.childName}
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-square rounded-xl bg-gradient-to-br from-[#FFD166] to-[#FF6B9D]" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-[#FF6B9D]">
              {s.archetype}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{s.childName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.blurb}</p>
          </article>
        ))}
      </section>

      <section className="mt-16 text-center">
        <Link
          href="/create"
          className="inline-flex items-center rounded-full bg-[#FF6B9D] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#FF6B9D]/30 transition hover:bg-[#e8588a]"
        >
          Make your kid&apos;s book
        </Link>
      </section>
    </main>
  );
}
