"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Multi-step wizard mirroring the storypop.shop flow we tested with real
 * customers. Four steps, each one a single decision so the form feels light
 * and the perceived progress matches the actual progress.
 *
 * Step 1: name + age
 * Step 2: free-form description ("describe your kid in your own words")
 * Step 3: free-form favorites ("Bluey, dragons, Frozen…")  → Claude
 *         translates into a trademark-safe archetype server-side.
 * Step 4: optional photo + email + 18+ confirm
 *
 * The merchant-template default (single page, 6-button archetype grid) is
 * gone — it didn't perform.
 */

// Quick-fill chips for step 2. Tapping appends a phrase to whatever the
// parent has typed; the actual personality lives in the freeform textarea.
const DESCRIPTION_CHIPS = [
  "super brave",
  "always asking why",
  "gives the best hugs",
  "loves dinosaurs",
  "silly and goofy",
  "shy at first, wild later",
  "obsessed with space",
  "kind to everyone",
];

// Suggestion chips for step 3. Ordered by popularity for the 3-8 age range.
// Server-side, Claude is instructed to translate the *vibe* of these into a
// story WITHOUT naming the trademarks — see lib/claude.ts.
const FAVORITES_CHIPS = [
  // Toddler/preschool blockbusters
  "Bluey",
  "Paw Patrol",
  "Peppa Pig",
  "Cocomelon",
  "Baby Shark",
  "Mickey Mouse",
  "Sesame Street",
  "Daniel Tiger",
  "Thomas & Friends",
  // Disney / Pixar / DreamWorks
  "Frozen",
  "Encanto",
  "Moana",
  "Lion King",
  "Toy Story",
  "Cars",
  "Finding Nemo",
  "Inside Out",
  "How to Train Your Dragon",
  "Trolls",
  "Minions",
  // Older-kid franchises
  "Barbie",
  "My Little Pony",
  "Hello Kitty",
  "Pokemon",
  "Mario",
  "Sonic",
  "Minecraft",
  "Roblox",
  "Spider-Man",
  "Avengers",
  "Star Wars",
  "Harry Potter",
  // Themes & animals
  "dinosaurs",
  "dragons",
  "mermaids",
  "unicorns",
  "princesses",
  "knights",
  "pirates",
  "space and rockets",
  "wizards & magic",
  "superheroes",
  "horses",
  "trains",
  "cars and trucks",
  "robots",
  "ninjas",
  "monsters",
];

interface FormState {
  childName: string;
  childAge: number;
  pronouns: "" | "he/him" | "she/her" | "they/them";
  description: string;
  favorites: string;
  photoFile: File | null;
  photoSkipped: boolean;
  buyerEmail: string;
  age18Confirmed: boolean;
}

const INITIAL: FormState = {
  childName: "",
  childAge: 4,
  pronouns: "",
  description: "",
  favorites: "",
  photoFile: null,
  photoSkipped: false,
  buyerEmail: "",
  age18Confirmed: false,
};

export default function CreateForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const canAdvanceStep1 = form.childName.trim().length > 0 && form.childAge >= 1;
  const canSubmit =
    form.age18Confirmed &&
    form.buyerEmail.trim().length > 3 &&
    (form.photoFile !== null || form.photoSkipped);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Photo upload (optional). We post a multipart body if a file was
      // chosen; otherwise just JSON. The API accepts both.
      let res: Response;
      if (form.photoFile) {
        const fd = new FormData();
        fd.append("childName", form.childName.trim());
        fd.append("childAge", String(form.childAge));
        if (form.pronouns) fd.append("pronouns", form.pronouns);
        fd.append("description", form.description.trim());
        fd.append("favorites", form.favorites.trim());
        fd.append("buyerEmail", form.buyerEmail.trim());
        fd.append("photo", form.photoFile);
        res = await fetch("/api/self-serve", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/self-serve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            childName: form.childName.trim(),
            childAge: form.childAge,
            pronouns: form.pronouns || undefined,
            description: form.description.trim() || undefined,
            favorites: form.favorites.trim() || undefined,
            buyerEmail: form.buyerEmail.trim(),
          }),
        });
      }
      // Tolerant body parsing: server might 500 with HTML if envs are missing.
      const text = await res.text();
      let data: { bookId?: string; error?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: `Server returned ${res.status} — ${text.slice(0, 100)}` };
      }
      if (!res.ok || !data.bookId) {
        setError(data.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }
      router.push(`/preview/${data.bookId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step progress dots */}
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-2 flex-1 rounded-full ${
              n <= step ? "bg-[#FF6B9D]" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        {step === 1 && (
          <Card title="What's your kid's name?" subtitle="We'll use this on every page.">
            <input
              autoFocus
              type="text"
              maxLength={40}
              value={form.childName}
              onChange={(e) => setForm({ ...form, childName: e.target.value })}
              placeholder="e.g. Luca"
              className="w-full rounded-2xl border-2 border-slate-200 p-4 text-2xl font-bold focus:border-[#FF6B9D] focus:outline-none"
            />
            <div className="mt-6">
              <label className="block text-sm font-bold text-slate-700">How old are they?</label>
              <input
                type="range"
                min={3}
                max={10}
                value={form.childAge}
                onChange={(e) => setForm({ ...form, childAge: Number(e.target.value) })}
                className="mt-2 w-full accent-[#FF6B9D]"
              />
              <div className="text-center text-3xl font-black text-[#FF6B9D]">{form.childAge}</div>
            </div>
            <Nav onNext={next} nextDisabled={!canAdvanceStep1} />
          </Card>
        )}

        {step === 2 && (
          <Card
            title={`Tell us about ${form.childName}`}
            subtitle="In your own words. The more specific, the more the story feels like them."
          >
            <textarea
              autoFocus
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 500) })}
              placeholder={`e.g. ${form.childName} is super silly, loves dinosaurs, asks "why?" 100x a day, and gives the best hugs. Shy at first but wild once they warm up.`}
              className="min-h-[150px] w-full resize-none rounded-2xl border-2 border-slate-200 p-4 font-medium leading-relaxed focus:border-[#FF6B9D] focus:outline-none"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{form.description.length}/500</span>
              <span>{form.description.trim() ? "" : "Optional but recommended"}</span>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Need a nudge? Tap to add:
              </div>
              <div className="flex flex-wrap gap-2">
                {DESCRIPTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => appendChip(form, setForm, "description", chip)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm transition hover:border-[#FF6B9D] hover:bg-[#FF6B9D]/5"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
            <Nav onBack={back} onNext={next} />
          </Card>
        )}

        {step === 3 && (
          <Card
            title={`What does ${form.childName} love?`}
            subtitle="Favorite shows, characters, animals, themes — anything. We'll write a story they'll instantly recognize the vibe of."
          >
            <textarea
              autoFocus
              maxLength={500}
              value={form.favorites}
              onChange={(e) => setForm({ ...form, favorites: e.target.value.slice(0, 500) })}
              placeholder="e.g. Bluey, dinosaurs, Frozen, and asking a million space questions"
              className="min-h-[140px] w-full resize-none rounded-2xl border-2 border-slate-200 p-4 font-medium leading-relaxed focus:border-[#FF6B9D] focus:outline-none"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{form.favorites.length}/500</span>
              <span>{form.favorites.trim() ? "" : "Optional but recommended"}</span>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Need a nudge? Tap to add:
              </div>
              <div className="flex max-h-[200px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                {FAVORITES_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => appendChip(form, setForm, "favorites", chip)}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs transition hover:border-[#FF6B9D] hover:bg-[#FF6B9D]/5"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
            <Nav onBack={back} onNext={next} />
          </Card>
        )}

        {step === 4 && (
          <Card
            title="Add a photo (optional)"
            subtitle={`Upload a clear, front-facing photo and ${form.childName} will appear as the hero on every page. Or skip — we'll draw a generic-but-adorable kid instead.`}
          >
            <label
              className={`flex aspect-video w-full cursor-pointer items-center justify-center rounded-2xl border-4 border-dashed bg-white text-slate-500 transition ${
                form.photoFile
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 hover:border-[#FF6B9D]"
              }`}
            >
              {form.photoFile ? (
                <span className="font-bold">✓ {form.photoFile.name}</span>
              ) : (
                <span className="text-center">
                  📸 Tap to upload a photo
                  <br />
                  <span className="text-xs text-slate-400">JPG or PNG · front-facing works best</span>
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setForm({ ...form, photoFile: file, photoSkipped: false });
                }}
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">
              By uploading you confirm you have permission to use this photo. Photos are deleted within 30 days and never used to train AI.
            </p>

            <button
              type="button"
              onClick={() => setForm({ ...form, photoFile: null, photoSkipped: !form.photoSkipped })}
              className={`mt-4 w-full rounded-2xl border-2 py-3 text-sm font-bold transition ${
                form.photoSkipped
                  ? "border-[#FF6B9D] bg-[#FF6B9D]/10 text-[#FF6B9D]"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {form.photoSkipped
                ? "✓ Skipping the photo — generic kid in the book"
                : "Skip — use a generic kid character"}
            </button>

            {/* Email + 18+ confirmation in step 4 so checkout has buyer info */}
            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-slate-900">
                Your email (so we can send you the preview)
                <input
                  type="email"
                  required
                  value={form.buyerEmail}
                  onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:border-[#FF6B9D] focus:outline-none"
                />
              </label>
              <label className="flex items-start gap-3 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={form.age18Confirmed}
                  onChange={(e) => setForm({ ...form, age18Confirmed: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  I&apos;m 18+ and the parent or guardian buying this book. I understand
                  StoryPop generates books with AI and stores my inputs per the{" "}
                  <a href="/privacy" className="underline">privacy policy</a>.
                </span>
              </label>
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="flex-[2] rounded-2xl bg-[#FF6B9D] py-3 font-bold text-white transition hover:bg-[#e8588a] disabled:opacity-50"
              >
                {submitting
                  ? "Generating preview…"
                  : !form.age18Confirmed
                    ? "Confirm 18+ to continue"
                    : !form.buyerEmail
                      ? "Add your email"
                      : !form.photoFile && !form.photoSkipped
                        ? "Add a photo or tap Skip"
                        : "Make my book ✨"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Takes about 5 minutes. No card required to see the preview.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold text-slate-600 transition hover:border-slate-300"
        >
          ← Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={`${onBack ? "flex-[2]" : "w-full"} rounded-2xl bg-[#FF6B9D] py-3 font-bold text-white transition hover:bg-[#e8588a] disabled:opacity-50`}
      >
        Next →
      </button>
    </div>
  );
}

function appendChip(
  form: FormState,
  setForm: (s: FormState) => void,
  field: "description" | "favorites",
  chip: string,
) {
  const current = form[field].trim();
  const next = current
    ? current.endsWith(",")
      ? `${current} ${chip}`
      : `${current}, ${chip}`
    : chip;
  setForm({ ...form, [field]: next.slice(0, 500) });
}
