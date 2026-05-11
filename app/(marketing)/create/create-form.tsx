"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ARCHETYPES = [
  { id: "bedtime", label: "Bedtime" },
  { id: "adventure", label: "Adventure" },
  { id: "first-day", label: "First day of school" },
  { id: "sibling", label: "New sibling" },
  { id: "lost-tooth", label: "Lost tooth" },
  { id: "birthday", label: "Birthday" },
] as const;

export default function CreateForm() {
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<number | "">("");
  const [pronouns, setPronouns] = useState<"he/him" | "she/her" | "they/them" | "">("");
  const [archetype, setArchetype] = useState<(typeof ARCHETYPES)[number]["id"] | "">("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [age18Confirmed, setAge18Confirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!age18Confirmed) {
      setError("You must confirm you're 18+ to use StoryPop.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/self-serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: childName.trim(),
          childAge: Number(childAge),
          pronouns: pronouns || undefined,
          archetype,
          buyerEmail: buyerEmail.trim(),
        }),
      });
      const data = (await res.json()) as { bookId?: string; error?: string };
      if (!res.ok || !data.bookId) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/preview/${data.bookId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-900">
          First name
          <Input
            required
            placeholder="Lily"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            className="mt-2"
            maxLength={40}
          />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Age
          <Input
            required
            type="number"
            min={1}
            max={12}
            placeholder="5"
            value={childAge}
            onChange={(e) => setChildAge(e.target.value === "" ? "" : Number(e.target.value))}
            className="mt-2"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-900">Pronouns (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["he/him", "she/her", "they/them"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPronouns(p)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                pronouns === p
                  ? "border-[#FF6B9D] bg-[#FF6B9D] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#FF6B9D]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-900">Story</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {ARCHETYPES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setArchetype(a.id)}
              className={`rounded-xl border px-3 py-3 text-sm transition ${
                archetype === a.id
                  ? "border-[#FF6B9D] bg-[#FFD166]/30 text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#FF6B9D]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm font-medium text-slate-900">
        Your email (so we can send you the preview)
        <Input
          required
          type="email"
          placeholder="you@example.com"
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
          className="mt-2"
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={age18Confirmed}
          onChange={(e) => setAge18Confirmed(e.target.checked)}
          className="mt-1"
        />
        <span>
          I&apos;m 18+ and the parent or guardian buying this book. I understand
          StoryPop generates books with AI and stores my inputs per the{" "}
          <a href="/privacy" className="underline">privacy policy</a>.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        disabled={submitting || !archetype || !childAge || !childName || !buyerEmail}
        className="w-full bg-[#FF6B9D] py-6 text-base text-white hover:bg-[#e8588a]"
      >
        {submitting ? "Starting…" : "See the first three pages free"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Takes about five minutes. No card required to see the preview.
      </p>
    </form>
  );
}
