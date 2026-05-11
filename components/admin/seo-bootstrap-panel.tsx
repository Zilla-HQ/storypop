"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BootstrapStep {
  name: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
}

interface BootstrapResult {
  appUrl: string;
  steps: BootstrapStep[];
  startedAt: string;
  finishedAt: string;
}

const STATUS_TONE: Record<BootstrapStep["status"], string> = {
  ok: "bg-emerald-100 text-emerald-800",
  skipped: "bg-slate-200 text-slate-700",
  error: "bg-red-100 text-red-800",
};

export function SeoBootstrapPanel({ ready }: { ready: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<BootstrapResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function fire() {
    setPending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/trigger?target=seo-bootstrap`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        result?: BootstrapResult;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.result) {
        setError(data.error ?? "Bootstrap failed");
      } else {
        setResult(data.result);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run bootstrap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adds this merchant's URL as a property in Google Search
          Console + Bing Webmaster, submits the sitemap, and pings
          IndexNow with every URL. Idempotent — safe to re-run.
        </p>
        {!ready ? (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            Required env vars missing — bootstrap will return a "skipped"
            result. Fix the configuration above and try again.
          </p>
        ) : null}
        <Button type="button" disabled={pending} onClick={fire}>
          {pending ? "Running…" : "Run SEO bootstrap"}
        </Button>

        {error ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">
              {new Date(result.startedAt).toLocaleString()} →{" "}
              {new Date(result.finishedAt).toLocaleString()}
            </div>
            <div className="text-xs font-medium">{result.appUrl}</div>
            <ul className="space-y-2">
              {result.steps.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm"
                >
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s.status]}`}
                  >
                    {s.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{s.name}</div>
                    {s.detail ? (
                      <div className="mt-1 break-words text-xs text-muted-foreground">
                        {s.detail}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
