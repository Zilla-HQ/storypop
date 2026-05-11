"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { BeforeAfterComparator } from "@/components/marketing/before-after-comparator";

const STEPS = [
  {
    id: "scraping",
    label: "Pulling the listing details + photos",
    detail: "Asking Zillow nicely for every photo on this listing.",
  },
  {
    id: "generating",
    label: "AI is studying the rooms",
    detail: "Classifying each photo: empty, dated, dark, exterior. Picking the best ones to demo.",
  },
  {
    id: "ready",
    label: "Done — your previews are ready",
    detail: "Redirecting you to compare them side-by-side.",
  },
] as const;

const FACTS = [
  "Listings with professional-quality photos sell 32% faster on average. — Redfin study, 50,000+ listings",
  "85% of homebuyers say photos are the #1 most useful feature on real-estate websites. — NAR Profile of Buyers and Sellers",
  "Professional photos correlate with $3,000–$11,000 higher sale prices on $200k–$1M homes. — Redfin",
  "Listings with high-quality photos receive 118% more online views. — VHT Studios",
  "We stamp every staged photo with a 'Virtually Staged' watermark — that's NAR's recommended disclosure.",
  "We never modify walls, doors, windows, or staircases — only paint, lighting, and furniture get touched.",
  "Empty rooms are the #1 reason agents use staging. Our AI fills them tastefully without altering structure.",
];

interface Status {
  phase: "scraping" | "generating" | "ready" | "failed";
  slug?: string;
  address?: string;
  error?: string;
}

interface Sample {
  id: string;
  before: string;
  after: string;
  caption: string;
}

export function GeneratingClient({ id, samples }: { id: string; samples: Sample[] }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>({ phase: "scraping" });
  const [factIdx, setFactIdx] = React.useState(0);
  const [sampleIdx, setSampleIdx] = React.useState(0);
  const [secondsElapsed, setSecondsElapsed] = React.useState(0);

  // Poll status
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/self-serve/status?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as Status;
        if (cancelled) return;
        setStatus(body);
        if (body.phase === "ready" && body.slug) {
          router.push(`/l/${body.slug}`);
          return;
        }
        if (body.phase !== "failed") {
          timer = setTimeout(tick, 3000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, router]);

  // Tick the elapsed clock every second so users see progress
  React.useEffect(() => {
    const t = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Rotate facts every 4 seconds
  React.useEffect(() => {
    const t = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4500);
    return () => clearInterval(t);
  }, []);

  // Rotate sample every 6 seconds
  React.useEffect(() => {
    if (samples.length === 0) return;
    const t = setInterval(() => setSampleIdx((i) => (i + 1) % samples.length), 6000);
    return () => clearInterval(t);
  }, [samples.length]);

  const activeIndex = STEPS.findIndex((s) => s.id === status.phase);
  const currentSample = samples[sampleIdx];
  const failed = status.phase === "failed";

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-background to-muted/40 py-10">
      <div className="container max-w-5xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">
            {failed ? "Hmm, ran into a snag" : "We're on it."}
          </h1>
          {status.address && status.address !== "Loading…" && (
            <p className="mt-1 text-sm text-muted-foreground">{status.address}</p>
          )}
          {!failed && (
            <p className="mt-2 text-sm text-muted-foreground">
              About 60–90 seconds. Hang out — we'll redirect you the moment it's ready.{" "}
              <span className="tabular-nums text-foreground">{secondsElapsed}s</span>
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Live progress card */}
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What's happening
              </div>
              <ol className="space-y-4">
                {STEPS.map((s, i) => {
                  const state = failed
                    ? i === activeIndex
                      ? "failed"
                      : i < activeIndex
                        ? "done"
                        : "pending"
                    : i < activeIndex
                      ? "done"
                      : i === activeIndex
                        ? "active"
                        : "pending";
                  return (
                    <li key={s.id} className="flex items-start gap-3">
                      <Indicator state={state} />
                      <div className="flex-1">
                        <div
                          className={`text-sm font-medium ${
                            state === "pending"
                              ? "text-muted-foreground"
                              : state === "failed"
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {s.label}
                        </div>
                        {state === "active" && !failed && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {failed && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
                  <div className="font-semibold">Couldn't process that listing.</div>
                  <div className="mt-1 text-muted-foreground">
                    {status.error ??
                      "The URL might be behind a login, recently delisted, or from an unsupported site."}
                  </div>
                </div>
              )}

              {!failed && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Did you know?
                  </div>
                  <p
                    key={factIdx}
                    className="mt-1 animate-in fade-in slide-in-from-bottom-1 text-sm leading-relaxed duration-700"
                  >
                    {FACTS[factIdx]}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample reel — shows what's possible while they wait */}
          {currentSample && !failed && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent before/afters from our pipeline
                </div>
                <div key={currentSample.id} className="animate-in fade-in duration-700">
                  <BeforeAfterComparator
                    beforeUrl={currentSample.before}
                    afterUrl={currentSample.after}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">{currentSample.caption}</p>
                </div>
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {samples.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === sampleIdx ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Indicator({ state }: { state: "pending" | "active" | "done" | "failed" }) {
  if (state === "done")
    return (
      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 6L5 9L10 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  if (state === "failed") return <div className="mt-0.5 h-5 w-5 rounded-full bg-destructive" />;
  if (state === "active")
    return (
      <div className="mt-0.5 h-5 w-5 animate-pulse rounded-full bg-primary ring-4 ring-primary/20" />
    );
  return <div className="mt-0.5 h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
}
