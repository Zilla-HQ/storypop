import Link from "next/link";
import { loadDiaryEntries, loadPersona, spectacleEnabled } from "@/lib/spectacle";

export const dynamic = "force-dynamic";

export default async function DiaryIndexPage() {
  if (!spectacleEnabled()) {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 560, margin: "auto" }}>
        <h1>Not found</h1>
      </main>
    );
  }
  const [entries, persona] = await Promise.all([
    loadDiaryEntries(),
    Promise.resolve(loadPersona()),
  ]);
  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 720, margin: "auto", lineHeight: 1.6 }}>
      <header>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
          {persona.name}&apos;s diary
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 24px 0", lineHeight: 1.2 }}>
          Notes from the workshop
        </h1>
      </header>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {entries.map((e) => (
          <li key={e.slug} style={{ marginBottom: 28 }}>
            <Link href={`/diary/${e.slug}`} style={{ color: "#0f172a", textDecoration: "none" }}>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{e.publishedAt}</p>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: "4px 0 6px 0" }}>{e.title}</h2>
              <p style={{ fontSize: 15, color: "#374151", margin: 0 }}>{e.excerpt}</p>
            </Link>
          </li>
        ))}
        {entries.length === 0 && <li style={{ color: "#64748b" }}>No entries yet.</li>}
      </ol>
    </main>
  );
}
