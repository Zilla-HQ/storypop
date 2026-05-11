import { loadBenchLeaderboard, spectacleEnabled } from "@/lib/spectacle";

export const dynamic = "force-dynamic";

export default async function BenchPage() {
  if (!spectacleEnabled()) {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 560, margin: "auto" }}>
        <h1>Not found</h1>
      </main>
    );
  }
  const rows = await loadBenchLeaderboard();
  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 720, margin: "auto", lineHeight: 1.6 }}>
      <header>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
          Model leaderboard
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 24px 0", lineHeight: 1.2 }}>
          Which model runs this merchant best?
        </h1>
        <p style={{ color: "#374151" }}>
          Each row is one model running this merchant autonomously for a week.
        </p>
      </header>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #1e293b" }}>
            <Th>Model</Th>
            <Th>Org</Th>
            <Th>Units</Th>
            <Th>Revenue</Th>
            <Th>CSAT</Th>
            <Th>Failure</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <Td>{r.modelName}</Td>
              <Td>{r.modelOrg ?? "—"}</Td>
              <Td>{r.unitsBuilt}</Td>
              <Td>${Math.round(r.revenueCents / 100).toLocaleString()}</Td>
              <Td>{r.csat ?? "—"}</Td>
              <Td>{r.failureRate ?? "—"}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={6}>
                <em>No completed runs yet.</em>
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "12px 8px", fontSize: 12, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>{children}</th>;
}
function Td(props: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={props.colSpan} style={{ padding: "12px 8px", fontSize: 15 }}>{props.children}</td>;
}
