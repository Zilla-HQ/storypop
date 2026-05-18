import Link from "next/link";
import { UTMCapture } from "@/components/marketing/UTMCapture";
import { MagicFlow } from "@/components/marketing/MagicFlow";

/**
 * Landing page — port of storypop.shop's `/` so the v2 (Zilla-HQ template)
 * marketing surface is visually indistinguishable from the v1 we tested
 * with real customers. Same hero copy, gradient text, animated CTA glow,
 * 10-tile sample grid, magic-flow explainer, testimonials, FAQ, final CTA.
 *
 * Where the two diverge:
 *   - /create takes the user through the multi-step wizard (already
 *     ported in app/(marketing)/create/create-form.tsx)
 *   - /preview/[id] uses the v2 Drizzle + R2 + Inngest pipeline
 */

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <UTMCapture />

      {/* NAV */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Storypop" className="h-14 w-auto" />
        </Link>
        <Link href="/create" className="btn-primary text-sm">
          Make a book
        </Link>
      </nav>

      {/* HERO */}
      <section className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 text-center">
        <span
          className="hero-fade-up inline-block bg-sunshine/40 text-ink px-4 py-1 rounded-bubble text-sm font-bold mb-4 relative"
          style={{ animationDelay: "0s" }}
        >
          16-page personalized book · printed-quality PDF · $14.99
        </span>
        <h1
          className="hero-fade-up text-5xl md:text-7xl font-display font-black tracking-tight leading-[1.05] mb-6 relative"
          style={{ animationDelay: "0.1s" }}
        >
          A storybook <br className="hidden md:block" />
          <span className="text-magic">starring your kid</span>.
        </h1>
        <p
          className="hero-fade-up text-xl md:text-2xl text-ink/70 max-w-2xl mx-auto mb-8 relative"
          style={{ animationDelay: "0.25s" }}
        >
          Tell us your kid&apos;s name, describe their personality, and name a few
          things they love. We write &amp; illustrate a custom 16-page adventure
          starring them. Ready in 2 minutes.{" "}
          <span className="text-ink/50">Photo optional.</span>
        </p>
        <div
          className="hero-fade-up flex flex-col sm:flex-row gap-3 justify-center mb-12 relative"
          style={{ animationDelay: "0.4s" }}
        >
          <Link href="/create" className="btn-primary btn-magic text-lg px-8 py-4">
            Start my book — $14.99
          </Link>
          <a href="#how" className="btn-secondary text-lg px-8 py-4">
            See how it works
          </a>
        </div>

        {/* Sample illustrations grid — 10 archetypes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 max-w-6xl mx-auto">
          {sampleSpreads.map((s) => (
            <div key={s.title} className="tile bg-white rounded-bubble overflow-hidden shadow-soft">
              <div className="aspect-square">
                <img src={s.image} alt={s.title} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-bold text-ink/80 text-center py-3 px-3">{s.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-display font-black text-center mb-3">
            How the magic happens
          </h2>
          <p className="text-center text-ink/60 max-w-xl mx-auto mb-10">
            Three stages. Ninety seconds. Watch the magic flow.
          </p>
          <MagicFlow />
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-20 bg-cream">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-display font-black mb-12">
            Made for the bedtime hall of fame
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card text-left">
                <div className="text-2xl mb-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="twinkle">
                      ⭐
                    </span>
                  ))}
                </div>
                <p className="text-ink/80 mb-3">&ldquo;{t.quote}&rdquo;</p>
                <div className="text-sm font-bold">— {t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-display font-black text-center mb-12">Quick questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <details key={f.q} className="card cursor-pointer group">
                <summary className="font-display font-black text-lg list-none flex justify-between">
                  {f.q}
                  <span className="text-coral group-open:rotate-45 transition">+</span>
                </summary>
                <p className="mt-3 text-ink/70">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 bg-coral text-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-5xl font-display font-black mb-6">Make tonight magical.</h2>
          <p className="text-xl mb-8 opacity-90">One book. Two minutes. Forever a memory.</p>
          <Link
            href="/create"
            className="btn-magic inline-flex items-center justify-center rounded-bubble bg-white text-coral font-black px-8 py-4 text-lg shadow-soft hover:scale-[1.02] transition"
          >
            Start my book — $14.99
          </Link>
        </div>
      </section>

      <footer className="py-10 text-center text-ink/50 text-sm">
        © {new Date().getFullYear()} Storypop · Made with love for big imaginations ·
        storypop.shop
      </footer>
    </main>
  );
}

const sampleSpreads = [
  { title: "Jungle prince", image: "/samples/lion.jpg" },
  { title: "Ice castle queen", image: "/samples/snow.jpg" },
  { title: "Dragon rider", image: "/samples/dragon.jpg" },
  { title: "Mermaid princess", image: "/samples/mermaid.jpg" },
  { title: "Wizard student", image: "/samples/wizard.jpg" },
  { title: "Space ranger", image: "/samples/space.jpg" },
  { title: "Dinosaur friend", image: "/samples/dinosaur.jpg" },
  { title: "Tiny superhero", image: "/samples/superhero.jpg" },
  { title: "Fairy-tale royal", image: "/samples/fairytale.jpg" },
  { title: "Backyard explorer", image: "/samples/backyard.jpg" },
];

const testimonials = [
  {
    name: "Maya, mom of Luca (4)",
    quote:
      "Luca asked to read it three times in a row. He pointed at himself on every page. Worth every penny.",
  },
  {
    name: "Dre, dad of twins",
    quote:
      "The fact that the kids look like THEM is what got me. My phone camera roll is 90% kid pics, may as well make a book.",
  },
  {
    name: "Sara, gifting auntie",
    quote: "Best birthday present I've ever sent. My niece thinks I'm a wizard now.",
  },
];

const faqs = [
  {
    q: "How long does it take?",
    a: "About 2 minutes from upload to preview. The full 16-page book is generated within 5 minutes after checkout.",
  },
  {
    q: "What ages is this for?",
    a: "Designed for kids ages 3–8. The story complexity adapts to the age you tell us.",
  },
  {
    q: "Can I print it?",
    a: "Yes — you get a print-ready 8.5\"×8.5\" PDF. Or upgrade to a real hardcover ($44.99, ships in 7–10 days) at checkout.",
  },
  {
    q: "Do you keep my kid's photo?",
    a: "No. Photos are auto-purged after 30 days of generation. We never train on your child's photo.",
  },
  {
    q: "What if I don't like the result?",
    a: "We'll regenerate it free, or refund within 7 days. We want this to be a happy memory.",
  },
];
