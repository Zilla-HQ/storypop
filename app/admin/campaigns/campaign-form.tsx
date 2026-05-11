"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { runCampaign } from "./actions";

interface Props {
  services: { id: string; name: string }[];
}

export function CampaignForm({ services }: Props) {
  const [serviceId, setServiceId] = React.useState(services[0]?.id ?? "pool-mockup");
  const [addresses, setAddresses] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<{
    queued: number;
    invalid: number;
    duplicates: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        startTransition(async () => {
          const lines = addresses
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          if (lines.length === 0) {
            setError("Paste at least one address.");
            return;
          }
          try {
            const r = await runCampaign({ serviceId, addresses: lines });
            setResult(r);
            setAddresses("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-2">
        <label className="text-sm font-medium">Service</label>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                serviceId === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">
          Addresses (one per line, full US format with city/state/zip)
        </label>
        <textarea
          value={addresses}
          onChange={(e) => setAddresses(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={`123 Main St, Phoenix, AZ 85001\n456 Oak Ave, Scottsdale, AZ 85251\n...`}
          disabled={pending}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Queuing…" : "Queue campaign"}
        </Button>
        {result && (
          <span className="text-sm text-emerald-600">
            ✓ Queued {result.queued} · {result.duplicates} dupe(s) · {result.invalid} invalid
          </span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <Card className="border-amber-500/50 bg-amber-50/60">
        <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
          <div>
            <b>Postcards</b>: gated by <code>admin_settings.mailer_enabled</code>. Off by
            default — only the mockup is generated. Flip the flag when you're ready to
            mail real postcards.
          </div>
          <div>
            <b>Cost</b>: ~$0.06 fal.ai + ~$0.55 Lob postage = $0.61 per address (when
            mailer enabled).
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
