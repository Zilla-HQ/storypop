import { notFound } from "next/navigation";
import { loadDiaryEntry, spectacleEnabled, loadPersona } from "@/lib/spectacle";

export const dynamic = "force-dynamic";

export default async function DiaryEntryPage(props: {
  params: Promise<{ slug: string }>;
}) {
  if (!spectacleEnabled()) notFound();
  const { slug } = await props.params;
  const entry = await loadDiaryEntry(slug);
  if (!entry) notFound();
  const persona = loadPersona();
  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 680, margin: "auto", lineHeight: 1.7 }}>
      <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
        {entry.publishedAt} · {persona.name}
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 32px 0", lineHeight: 1.2 }}>
        {entry.title}
      </h1>
      <article
        style={{ fontSize: 17, color: "#1e293b" }}
        // Raw markdown body. Production should pipe through a real
        // renderer (e.g. `marked` or `remark`). Keeping the simple text
        // dump avoids pinning a markdown dep choice in the template.
      >
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "system-ui", fontSize: 17, margin: 0 }}>
          {entry.body}
        </pre>
      </article>
      <footer style={{ marginTop: 48, fontSize: 13 }}>
        <a href="/diary" style={{ color: "#0f766e" }}>
          ← All entries
        </a>
      </footer>
    </main>
  );
}
