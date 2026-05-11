"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ImportResult {
  matched: number;
  processed: number;
  withEmail: number;
  added: number;
  alreadyExisted: number;
  sent: number;
  failed: number;
  preview?: { siteUrl: string; email: string }[];
}

const DEFAULT_KEYWORDS = [
  "agency",
  "studio",
  "marketing",
  "design",
  "media",
  "creative",
  "consulting",
  "consult",
  "digital",
  "webdesign",
  "web-design",
  "webdev",
  "seo",
  "wordpress",
  "shopify",
];

/**
 * Mine the existing `sites` table for agency-shaped URLs and feed
 * them into partner_outreach. No Apify required — uses cached site
 * URLs from prior audit-pipeline runs.
 */
export function PartnerImportFromSites() {
  const router = useRouter();
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS.join(", "));
  const [limit, setLimit] = useState(50);
  const [autoSend, setAutoSend] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const parsedKeywords = keywords
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/partner-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_from_sites",
          keywords: parsedKeywords,
          limit,
          dryRun,
          autoSend: !dryRun && autoSend,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Import failed");
        setSubmitting(false);
        return;
      }
      setResult(json);
      if (!dryRun) router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Keywords (comma-separated)
        </label>
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={2}
          disabled={submitting}
          className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Hostnames containing any of these substrings are flagged as
          candidate partners. Conservative — better to miss a few than
          spam SMBs with the partner pitch.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Limit:
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10) || 50)}
            disabled={submitting}
            className="ml-2 w-20 rounded-md border bg-background p-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            disabled={submitting}
          />
          Auto-send initial pitch
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => run(true)}
        >
          {submitting ? "Working…" : "Preview (dry-run)"}
        </Button>
        <Button
          type="button"
          disabled={submitting}
          onClick={() => run(false)}
        >
          {submitting ? "Working…" : "Run import"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Matched" value={result.matched} />
            <Stat label="Scraped" value={result.processed} />
            <Stat label="With email" value={result.withEmail} />
            <Stat label="Added" value={result.added} />
            <Stat label="Already in DB" value={result.alreadyExisted} />
            <Stat label="Sent" value={result.sent} />
            <Stat label="Failed sends" value={result.failed} />
          </div>
          {result.preview && result.preview.length > 0 ? (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sample
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {result.preview.map((p) => (
                  <li key={p.email} className="flex items-center justify-between gap-2">
                    <span className="font-mono">{p.email}</span>
                    <span className="text-muted-foreground truncate">{p.siteUrl}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-background p-2 text-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
