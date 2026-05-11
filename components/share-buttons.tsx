"use client";

import { useEffect, useState } from "react";

interface ShareButtonsProps {
  title: string;
  // Optional override; defaults to the current window.location.href.
  url?: string;
  // Hashtag/affordance copy for X — keep short.
  via?: string;
}

export function ShareButtons({ title, url, via }: ShareButtonsProps) {
  const [resolvedUrl, setResolvedUrl] = useState(url ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (url) return;
    if (typeof window === "undefined") return;
    setResolvedUrl(window.location.href);
  }, [url]);

  if (!resolvedUrl) return null;

  const encodedUrl = encodeURIComponent(resolvedUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedVia = via ? encodeURIComponent(via) : "";

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}${
    encodedVia ? `&via=${encodedVia}` : ""
  }`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const emailUrl = `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Share:</span>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border bg-background px-3 py-1.5 font-medium hover:bg-muted"
      >
        X / Twitter
      </a>
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border bg-background px-3 py-1.5 font-medium hover:bg-muted"
      >
        LinkedIn
      </a>
      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border bg-background px-3 py-1.5 font-medium hover:bg-muted"
      >
        Facebook
      </a>
      <a
        href={emailUrl}
        className="rounded-md border bg-background px-3 py-1.5 font-medium hover:bg-muted"
      >
        Email
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(resolvedUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="rounded-md border bg-background px-3 py-1.5 font-medium hover:bg-muted"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
