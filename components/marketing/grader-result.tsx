"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  result: {
    sourceId: string;
    canonicalUrl: string;
    listing: {
      title?: string;
      city?: string;
      state?: string;
      photoCount: number;
      thumbnail: string | null;
      reviewCount: number | null;
      avgRating: number | null;
      isSuperhost: boolean | null;
    };
    grade: {
      overall: number;
      letter: "A" | "B" | "C" | "D" | "F";
      copy: { score: number; issues: string[] };
      photos: { score: number; issues: string[]; sampledCount: number };
      signals: { score: number; issues: string[] };
      topFixes: string[];
    };
  };
}

interface FlashStatus {
  active: boolean;
  spotsLeft: number;
  expiresAt: number | null;
  percentOff?: number | null;
  code?: string;
}

export function GraderResultView({ result }: Props) {
  const { grade, listing } = result;
  const [copied, setCopied] = React.useState(false);
  const [flash, setFlash] = React.useState<FlashStatus | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/flash-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: FlashStatus) => {
        if (!cancelled) setFlash(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const colorClass = colorForLetter(grade.letter);
  const flashActive = !!flash?.active && flash.spotsLeft > 0;
  const tuneUpHref = flashActive
    ? `/?paste=${encodeURIComponent(result.canonicalUrl)}&promo=FLASH50#paste`
    : `/?paste=${encodeURIComponent(result.canonicalUrl)}#paste`;

  const shareUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    // base64url-encode the canonical Airbnb URL into the share path so the
    // share page can re-render the grade with full OG image preview.
    const encoded = btoa(result.canonicalUrl)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `${window.location.origin}/grade/share?u=${encoded}`;
  }, [result.canonicalUrl]);

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const tweet = `My Airbnb listing scored ${grade.overall}/100 on the Restay grader (${grade.letter}). Try yours: `;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className={`flex h-32 w-32 flex-col items-center justify-center rounded-2xl ${colorClass.bg}`}>
            <div className={`text-6xl font-bold leading-none ${colorClass.text}`}>{grade.letter}</div>
            <div className={`mt-1 text-xs font-semibold uppercase tracking-wider ${colorClass.text}`}>
              {grade.overall}/100
            </div>
          </div>
          <div className="space-y-1">
            {listing.title && (
              <div className="text-lg font-semibold">{listing.title}</div>
            )}
            <div className="text-sm text-muted-foreground">
              {listing.city && listing.state ? `${listing.city}, ${listing.state}` : listing.city}
              {" · "}
              {listing.photoCount} photos
              {typeof listing.reviewCount === "number" && (
                <>
                  {" · "}
                  {listing.reviewCount} reviews
                </>
              )}
              {typeof listing.avgRating === "number" && (
                <>
                  {" · "}
                  {listing.avgRating.toFixed(2)}★
                </>
              )}
              {listing.isSuperhost && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">Superhost</span>}
            </div>
            <p className="pt-2 text-sm text-muted-foreground">
              {summaryFor(grade.letter)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Score breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <ScoreCard
          label="Photos"
          score={grade.photos.score}
          weight="45%"
          issues={grade.photos.issues}
          note={grade.photos.sampledCount > 0 ? `Sampled ${grade.photos.sampledCount} photos via Claude vision.` : undefined}
        />
        <ScoreCard
          label="Copy"
          score={grade.copy.score}
          weight="35%"
          issues={grade.copy.issues}
        />
        <ScoreCard
          label="Listing signals"
          score={grade.signals.score}
          weight="20%"
          issues={grade.signals.issues}
          note="Title length, description depth, review/rating mix."
        />
      </div>

      {/* Share strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <span className="font-semibold">Share this score.</span>{" "}
            <span className="text-muted-foreground">Brag, or shame yourself into the fix.</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={copyShareLink} size="sm" variant="outline" disabled={!shareUrl}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <a href={twitterHref} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" disabled={!shareUrl}>
                Tweet
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Top fixes */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top 3 fixes
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
              What to attack first.
            </h3>
          </div>
          <ol className="space-y-3">
            {grade.topFixes.map((fix, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm">{fix}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Free sample CTA — captures email + queues 2 photo restyles emailed to the visitor */}
      <FreeSampleCTA canonicalUrl={result.canonicalUrl} />

      {/* Upgrade CTA */}
      {flashActive ? (
        <Card className="border-2 border-emerald-500 bg-emerald-50/60 shadow-sm">
          <CardContent className="space-y-4 p-6 text-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                <span>Launch flash · 50% off</span>
                <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">FLASH50</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">
                Fix this listing for <span className="text-emerald-700">$39</span>{" "}
                <span className="text-base font-medium text-muted-foreground line-through">$79</span>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Rewritten title + description, 10 restyled photos, 30-day pricing
                report. Auto-applies at checkout — no code to type. <strong className="text-emerald-800">{flash!.spotsLeft} of 10 spots left.</strong>
                {flash!.expiresAt && (
                  <>
                    {" "}Expires <FlashCountdown expiresAt={flash!.expiresAt} />.
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link href={tuneUpHref}>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                  Claim 50% off — $39 Tune-Up →
                </Button>
              </Link>
              <Link href={result.canonicalUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="lg">
                  View listing on Airbnb →
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Edit-only photos · No subscription · 14-day refund window
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary bg-primary/5">
          <CardContent className="space-y-4 p-6 text-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                Done-for-you
              </div>
              <h3 className="text-2xl font-bold tracking-tight">
                Want us to fix all of this in under 4 hours?
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The Listing Tune-Up: rewritten title + description, 10 restyled photos,
                and a 30-day pricing report. One-time $79. Less than a month of Guesty.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link href={tuneUpHref}>
                <Button size="lg">Get the $79 Tune-Up</Button>
              </Link>
              <Link href={result.canonicalUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="lg">
                  View listing on Airbnb →
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Edit-only photos · No subscription · 14-day refund window
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FreeSampleCTA({ canonicalUrl }: { canonicalUrl: string }) {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/self-serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: canonicalUrl, email }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-50/50">
        <CardContent className="space-y-2 p-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-emerald-900">
            Samples are on the way.
          </div>
          <p className="text-sm text-emerald-800">
            We'll email <strong>{email}</strong> as soon as your 2 restyled photos are ready —
            usually under 90 seconds. The email also includes a 10% off code if you want the full Tune-Up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Free · Emailed to you
          </div>
          <h3 className="text-2xl font-bold tracking-tight">
            See 2 of your photos restyled — free.
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Same edit-only pipeline that runs on the paid Tune-Up — declutter, relight, color-grade.
            We'll email the before/after pair so you can decide if you like the look. Includes a 10% off code if you want the full thing.
          </p>
        </div>
        <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 text-base"
            autoComplete="email"
            inputMode="email"
            disabled={submitting}
          />
          <Button type="submit" size="lg" disabled={!valid || submitting}>
            {submitting ? "Sending…" : "Email me my samples"}
          </Button>
        </form>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          No signup. We only email the samples + one optional follow-up. Unsubscribe in one click.
        </p>
      </CardContent>
    </Card>
  );
}

function FlashCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, expiresAt - now);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (ms <= 0) return <span>now</span>;
  if (h >= 24) return <span>in {Math.floor(h / 24)}d {h % 24}h</span>;
  if (h >= 1) return <span className="font-mono">in {h}h {m.toString().padStart(2, "0")}m</span>;
  return <span className="font-mono">in {m}m {s.toString().padStart(2, "0")}s</span>;
}

function ScoreCard(props: {
  label: string;
  score: number;
  weight: string;
  issues: string[];
  note?: string;
}) {
  const color = colorForScore(props.score);
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold">{props.label}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            weight {props.weight}
          </div>
        </div>
        <div className={`text-4xl font-bold tracking-tight ${color}`}>
          {props.score}
          <span className="text-base text-muted-foreground">/100</span>
        </div>
        {props.issues.length > 0 ? (
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {props.issues.map((issue, i) => (
              <li key={i} className="flex gap-1.5">
                <span>·</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No major issues found.</p>
        )}
        {props.note && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {props.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function colorForLetter(letter: "A" | "B" | "C" | "D" | "F"): { bg: string; text: string } {
  switch (letter) {
    case "A":
      return { bg: "bg-emerald-500/10", text: "text-emerald-700" };
    case "B":
      return { bg: "bg-lime-500/10", text: "text-lime-700" };
    case "C":
      return { bg: "bg-amber-500/10", text: "text-amber-700" };
    case "D":
      return { bg: "bg-orange-500/10", text: "text-orange-700" };
    case "F":
      return { bg: "bg-red-500/10", text: "text-red-700" };
  }
}

function colorForScore(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 65) return "text-lime-700";
  if (score >= 50) return "text-amber-700";
  return "text-orange-700";
}

function summaryFor(letter: "A" | "B" | "C" | "D" | "F"): string {
  switch (letter) {
    case "A":
      return "Genuinely strong listing. Marginal gains only — focus on photo refresh and seasonal pricing.";
    case "B":
      return "Solid foundation with two or three high-leverage fixes that would lift conversion materially.";
    case "C":
      return "Average. The fixes below would put this in the top quartile for the city.";
    case "D":
      return "Underperforming. Most listings in this range haven't been updated in 12+ months.";
    case "F":
      return "Significant work needed. The good news: the lift from a tune-up here is the largest.";
  }
}
