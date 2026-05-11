"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "pass" | "warn" | "fail";

interface RunResult {
  status: Status;
  summary: string;
  detail?: string;
  domain?: string;
  data?: Record<string, unknown>;
}

const TONE: Record<Status, string> = {
  pass: "border-emerald-500/40 bg-emerald-50 text-emerald-900",
  warn: "border-amber-500/40 bg-amber-50 text-amber-900",
  fail: "border-red-500/40 bg-red-50 text-red-900",
};

const LABEL: Record<Status, string> = {
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
};

export function ToolRunner({
  tool,
  ctaCopy,
  placeholder = "yourdomain.com",
}: {
  tool: string;
  ctaCopy: string;
  placeholder?: string;
}) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tools/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Check failed");
      } else {
        setResult(json);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder={placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={submitting}
          className="h-12 flex-1 text-base"
        />
        <Button type="submit" disabled={submitting || !url} size="lg" className="h-12 sm:w-48">
          {submitting ? "Checking…" : ctaCopy}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className={`rounded-lg border p-5 ${TONE[result.status]}`}>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider">
            {LABEL[result.status]}
          </div>
          <p className="text-base font-semibold">{result.summary}</p>
          {result.detail ? <p className="mt-2 text-sm">{result.detail}</p> : null}
          {result.data && "description" in result.data && result.data.description ? (
            <pre className="mt-3 overflow-x-auto rounded bg-white/60 p-3 text-xs">
              {String(result.data.description)}
            </pre>
          ) : null}
          {result.data && "title" in result.data && result.data.title ? (
            <pre className="mt-3 overflow-x-auto rounded bg-white/60 p-3 text-xs">
              {String(result.data.title)}
            </pre>
          ) : null}
          {result.data && "robotsTxt" in result.data && result.data.robotsTxt ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold">
                View robots.txt
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-white/60 p-3 text-xs">
                {String(result.data.robotsTxt).slice(0, 4000)}
              </pre>
            </details>
          ) : null}
          {result.domain ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-current/10 pt-4 text-sm">
              <a
                href={`/seo-audit/${encodeURIComponent(result.domain)}`}
                className="font-semibold underline underline-offset-2"
              >
                Run all 13 checks on {result.domain} →
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
