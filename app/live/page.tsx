import { loadLiveCounters, loadPersona, spectacleEnabled } from "@/lib/spectacle";

/**
 * Public counter dashboard. Refreshes every render — Next.js server
 * components fetch on each request unless cached.
 *
 * Disabled by default: set SPECTACLE_ENABLED=true to surface this page.
 * When disabled, returns a 404-equivalent.
 */
export const dynamic = "force-dynamic";

export default async function LivePage() {
  if (!spectacleEnabled()) {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 560, margin: "auto" }}>
        <h1>Not found</h1>
        <p>The live dashboard is disabled for this merchant.</p>
      </main>
    );
  }
  const [counters, persona] = await Promise.all([
    loadLiveCounters(),
    Promise.resolve(loadPersona()),
  ]);
  const revWeek = Math.round(counters.revenueCentsThisWeek / 100);
  const revAll = Math.round(counters.revenueCentsAllTime / 100);
  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 720, margin: "auto", lineHeight: 1.6 }}>
      <header>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
          {persona.name} is currently…
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 0 0", lineHeight: 1.2 }}>
          {counters.statusLine}
        </h1>
      </header>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, margin: "40px 0" }}>
        <Box label="Built all-time" value={String(counters.unitsBuiltAllTime)} />
        <Box label="Built this week" value={String(counters.unitsBuiltThisWeek)} />
        <Box label="Revenue all-time" value={`$${revAll.toLocaleString()}`} />
        <Box label="Revenue this week" value={`$${revWeek.toLocaleString()}`} />
      </section>
      <footer style={{ fontSize: 13, color: "#64748b" }}>
        <a href="/diary" style={{ color: "#0f766e", marginRight: 16 }}>
          Diary
        </a>
        <a href="/bench" style={{ color: "#0f766e", marginRight: 16 }}>
          Bench
        </a>
        {persona.twitterHandle && (
          <a href={`https://x.com/${persona.twitterHandle}`} style={{ color: "#0f766e" }}>
            @{persona.twitterHandle}
          </a>
        )}
      </footer>
    </main>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 24,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 0 0" }}>
        {value}
      </p>
    </div>
  );
}
