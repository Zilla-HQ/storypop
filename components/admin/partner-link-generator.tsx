"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://restay.agency").replace(
  /\/$/,
  "",
);

const LANDING_OPTIONS = [
  { path: "/", label: "Homepage (URL paste)" },
  { path: "/grade", label: "Free grader" },
  { path: "/host", label: "Tune-Up landing" },
  { path: "/blog", label: "Blog" },
] as const;

export function PartnerLinkGenerator() {
  const [handle, setHandle] = React.useState("");
  const [landing, setLanding] = React.useState<string>("/grade");
  const [copied, setCopied] = React.useState(false);

  const slug = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
  const url = slug
    ? `${APP_URL}${landing}?utm_source=partner&utm_medium=referral&utm_campaign=affiliate&utm_content=${encodeURIComponent(slug)}`
    : "";

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Partner handle
          </label>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. jasper-ribbers, str-lab, hosting-journey"
            maxLength={60}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            We slugify automatically (lowercase, hyphens, no spaces).
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Landing page
          </label>
          <div className="flex flex-wrap gap-2">
            {LANDING_OPTIONS.map((o) => (
              <button
                key={o.path}
                type="button"
                onClick={() => setLanding(o.path)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  landing === o.path
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {url && (
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Referral link
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {url}
              </code>
              <Button onClick={copyLink} size="sm">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              UTM source = <code>partner</code>, content = <code>{slug}</code>. Listings + orders attribute automatically.
            </p>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Co-branded landing page
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {`${APP_URL}/p/${slug}`}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(`${APP_URL}/p/${slug}`)}
              >
                Copy
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              "<strong>{handle || "Their brand"}</strong> × Restay" co-branded grader. Auto-applies partner UTMs.
            </p>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Iframe embed snippet (for their site)
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-3 text-[11px] leading-relaxed">
              {`<iframe src="${APP_URL}/embed/${slug}"
        width="100%" height="700"
        style="border:0;border-radius:12px"
        loading="lazy"></iframe>`}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() =>
                navigator.clipboard.writeText(
                  `<iframe src="${APP_URL}/embed/${slug}" width="100%" height="700" style="border:0;border-radius:12px" loading="lazy"></iframe>`,
                )
              }
            >
              Copy snippet
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Drop this on a Teachable / Skool / Substack / WordPress page. Every
              grader run inside the iframe attributes to <code>{slug}</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
