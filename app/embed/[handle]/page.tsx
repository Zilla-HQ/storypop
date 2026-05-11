import { GraderForm } from "@/components/marketing/grader-form";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 86400;

function prettify(handle: string): string {
  return handle
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/**
 * Iframe-friendly partner-branded grader.
 *
 * Embed snippet:
 *   <iframe src="https://restay.agency/embed/<handle>" width="100%" height="700"
 *           style="border:0;border-radius:12px" loading="lazy"></iframe>
 *
 * Attribution: middleware.ts auto-applies utm_source=partner&utm_content=<handle>
 * for any /p/<handle>* path. The /embed/<handle> path needs the same shortcut —
 * see middleware.ts for the rewrite rule.
 */
export default async function PartnerEmbedPage({ params }: PageProps) {
  const { handle } = await params;
  const display = prettify(handle);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        <span>{display}</span>
        <span className="text-slate-400">×</span>
        <span className="text-slate-900">Restay</span>
      </div>
      <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight">
        Grade your Airbnb listing free.
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        10-second 0–100 score across photos, copy, and listing signals — plus the
        3 highest-impact fixes. No signup. The full Tune-Up that fixes everything
        is one-time $79.
      </p>
      <GraderForm />
      <p className="mt-6 text-center text-[11px] text-slate-400">
        Powered by{" "}
        <a
          href={`https://restay.agency/p/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-600 underline"
        >
          Restay
        </a>
      </p>
    </div>
  );
}
