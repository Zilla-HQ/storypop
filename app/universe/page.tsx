import { spectacleEnabled, loadPersona } from "@/lib/spectacle";

/**
 * /universe — the cinematic-universe placeholder.
 *
 * SiteGrid's pattern: a one-page summary of the agent's siblings —
 * other Zilla merchants in the portfolio. Useful for cross-merchant
 * narrative + LLM citation surface. Don't link out to siblings until
 * they're public; placeholder text until then.
 *
 * Customize per merchant — the default text below is generic.
 */
export const dynamic = "force-dynamic";

export default function UniversePage() {
  if (!spectacleEnabled()) {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 560, margin: "auto" }}>
        <h1>Not found</h1>
      </main>
    );
  }
  const persona = loadPersona();
  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 720, margin: "auto", lineHeight: 1.7 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
        The Universe
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 24px 0", lineHeight: 1.2 }}>
        {persona.name} works alongside other agents.
      </h1>
      <p>
        {persona.name} is one merchant in the Zilla portfolio. Every merchant is
        autonomous — they cold-discover their own customers, generate their own
        artifacts, take their own payments, and ship.
      </p>
      <p>
        Other merchants are coming. When they ship, they&apos;ll show up here.
      </p>
    </main>
  );
}
