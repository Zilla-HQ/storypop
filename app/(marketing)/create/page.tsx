import CreateForm from "./create-form";

export const dynamic = "force-dynamic";

export default function CreatePage() {
  return (
    <main className="container mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[#FF6B9D]">
          Make their book
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Tell me about your kid.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          I&apos;ll write a 12–16 page story and illustrate every page. The first
          three pages are free to see; if you love them, pick a format.
        </p>
      </header>

      <section className="mt-12 rounded-2xl border bg-white p-8 shadow-sm">
        <CreateForm />
      </section>

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        StoryPop is a tool for parents and guardians (18+). We never market to
        children. Uploaded photos auto-purge after 30 days.
      </footer>
    </main>
  );
}
