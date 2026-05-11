"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

/**
 * Composer for posting tweets / threads from /admin/x.
 *
 * Convention: paragraphs separated by blank lines = thread tweets in
 * order. A single paragraph = single tweet.
 */
export function TweetComposer({ brandHandle }: { brandHandle?: string | null }) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; text: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = brandHandle ?? "";

  const tweets = body
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lengths = tweets.map((t) => t.length);
  const overLimit = lengths.find((l) => l > 280);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (overLimit) return;
    if (tweets.length === 0) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload =
        tweets.length === 1 ? { text: tweets[0] } : { thread: tweets };
      const res = await fetch("/api/admin/post-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
      } else {
        setResult(json.tweets ?? []);
        setBody("");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={14}
        disabled={submitting}
        placeholder={`Single tweet body, OR multiple paragraphs separated by blank lines for a thread.`}
        className="w-full rounded-md border bg-background p-3 font-mono text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span>
          {tweets.length === 0
            ? "(empty)"
            : tweets.length === 1
              ? "single tweet"
              : `thread of ${tweets.length}`}
        </span>
        {tweets.map((t, i) => (
          <span
            key={i}
            className={`rounded px-2 py-0.5 ${
              t.length > 280
                ? "bg-red-100 text-red-800"
                : t.length > 250
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-50 text-emerald-800"
            }`}
          >
            #{i + 1} · {t.length}/280
          </span>
        ))}
      </div>
      <Button
        type="submit"
        disabled={submitting || tweets.length === 0 || Boolean(overLimit)}
      >
        {submitting
          ? "Posting…"
          : tweets.length > 1
            ? `Post thread (${tweets.length} tweets)`
            : "Post tweet"}
      </Button>
      {overLimit ? (
        <p className="text-sm text-destructive">
          One or more tweets exceed 280 chars. Trim before posting.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result && result.length > 0 ? (
        <div className="space-y-2 rounded-md border bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-900">
            ✓ Posted {result.length} tweet{result.length === 1 ? "" : "s"}
          </p>
          {result.map((t) => (
            <a
              key={t.id}
              href={handle ? `https://x.com/${handle}/status/${t.id}` : `https://x.com/i/web/status/${t.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-emerald-700 underline-offset-2 hover:underline"
            >
              {handle ? `x.com/${handle}/status/${t.id}` : `x.com/i/web/status/${t.id}`}
            </a>
          ))}
        </div>
      ) : null}
    </form>
  );
}
