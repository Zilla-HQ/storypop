"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ManualTrigger() {
  const [pending, setPending] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  async function fire(target: "realtor" | "homeowner" | "social-poster") {
    setPending(target);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/trigger?target=${target}`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; fired?: string; error?: string };
      setResult(
        data.ok
          ? `✓ fired ${data.fired} — watch /admin/listings + Inngest dashboard for results`
          : `✗ ${data.error ?? "failed"}`,
      );
    } catch (e) {
      setResult(`✗ ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run discovery now</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Manually kick a discovery cycle without waiting for the next 6h / 12h cron tick.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending !== null}
            onClick={() => fire("realtor")}
          >
            {pending === "realtor" ? "Firing…" : "Realtor scrape"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => fire("homeowner")}
          >
            {pending === "homeowner" ? "Firing…" : "Homeowner scrape"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => fire("social-poster")}
          >
            {pending === "social-poster" ? "Firing…" : "Social poster (Pinterest)"}
          </Button>
        </div>
        {result && (
          <p className="text-xs font-mono text-muted-foreground">{result}</p>
        )}
      </CardContent>
    </Card>
  );
}
