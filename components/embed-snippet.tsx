"use client";

import { useState } from "react";

const SNIPPET = `<iframe
  src="https://sitebeat.tech/embed/widget?ref=YOUR_REF_CODE"
  title="Free SEO audit"
  loading="lazy"
  style="width:100%;max-width:480px;height:420px;border:0;"
></iframe>`;

export function EmbedSnippet() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <pre className="overflow-x-auto rounded-lg border bg-slate-900 p-4 text-xs text-slate-100">
        <code>{SNIPPET}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(SNIPPET).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="mt-3 rounded-md border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
      >
        {copied ? "Copied!" : "Copy snippet"}
      </button>
    </div>
  );
}
