"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraderResultView } from "@/components/marketing/grader-result";

interface GradeResponse {
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
  eventId: string;
}

export function GraderForm() {
  const [url, setUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GradeResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = (await res.json()) as GradeResponse | { error?: string };
      if (!res.ok || !("grade" in body)) {
        throw new Error(("error" in body && body.error) || "Something went wrong");
      }
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grade listing");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your Airbnb listing URL"
            className="h-12 flex-1 text-base"
            disabled={pending}
          />
          <Button type="submit" size="lg" disabled={pending || !url}>
            {pending ? "Grading…" : "Grade my listing"}
          </Button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {pending && (
          <p className="text-center text-xs text-muted-foreground">
            Reading your listing, scoring photos with Claude vision, scanning copy…
            usually 4–8 seconds.
          </p>
        )}
      </form>

      {result && (
        <div className="mt-10">
          <GraderResultView result={result} />
        </div>
      )}
    </div>
  );
}
