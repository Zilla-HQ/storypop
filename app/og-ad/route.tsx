import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Sitebeat ad creative — multi-format ad image generator.
 *
 * Variants (?v=):
 *   hook    — "What grade is your SEO?" with red F (default)
 *   fix     — "Find what's broken. Get the exact fix." with C
 *   weekly  — "If your SEO regressed yesterday, would you know?" with B
 *
 * Formats (?format=):
 *   square    — 1080x1080 (default; Feed)
 *   vertical  — 1080x1920 (Stories / Reels / 9:16)
 *
 * Right-click → Save image, then upload to Meta Ads Manager.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const variant = url.searchParams.get("v") ?? "hook";
  const format = url.searchParams.get("format") ?? "square";

  const variants: Record<string, { eyebrow: string; headline: string; sub: string; grade: string; gradeColor: string }> = {
    hook: {
      eyebrow: "SITEBEAT",
      headline: "What grade is your SEO?",
      sub: "13 checks · 30 seconds · free",
      grade: "F",
      gradeColor: "#ef4444",
    },
    fix: {
      eyebrow: "SITEBEAT",
      headline: "Find what's broken. Get the exact fix.",
      sub: "Free 13-point SEO audit",
      grade: "C",
      gradeColor: "#f59e0b",
    },
    weekly: {
      eyebrow: "SITEBEAT · WEEKLY MONITORING",
      headline: "If your SEO regressed yesterday, would you know?",
      sub: "We re-check every Monday. Silence unless something breaks.",
      grade: "B",
      gradeColor: "#22c55e",
    },
  };

  const v = variants[variant] ?? variants.hook;
  const isVertical = format === "vertical";
  const W = isVertical ? 1080 : 1080;
  const H = isVertical ? 1920 : 1080;

  const layout = isVertical ? renderVertical(v) : renderSquare(v);

  return new ImageResponse(layout, { width: W, height: H });
}

function renderSquare(v: { eyebrow: string; headline: string; sub: string; grade: string; gradeColor: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
        padding: 80,
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", color: "#10b981", fontSize: 24, fontWeight: 800, letterSpacing: 4 }}>
        {v.eyebrow}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 64, marginTop: 60 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 320,
            height: 320,
            borderRadius: 64,
            background: v.gradeColor,
            color: "#ffffff",
            boxShadow: "0 30px 60px -15px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontSize: 240, fontWeight: 800, lineHeight: 1, marginBottom: -20 }}>{v.grade}</div>
          <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.9, letterSpacing: 2 }}>SEO GRADE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, letterSpacing: -2 }}>
            {v.headline}
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: "#475569", fontWeight: 500 }}>{v.sub}</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 40,
          paddingTop: 32,
          borderTop: "2px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#0f172a",
            color: "#ffffff",
            padding: "20px 36px",
            borderRadius: 16,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          Get my grade →
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#0f172a", fontWeight: 700, letterSpacing: -0.5 }}>
          sitebeat.tech
        </div>
      </div>
    </div>
  );
}

function renderVertical(v: { eyebrow: string; headline: string; sub: string; grade: string; gradeColor: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 60%, #e2e8f0 100%)",
        padding: "120px 80px",
        fontFamily: "-apple-system, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      {/* Brand eyebrow */}
      <div
        style={{
          display: "flex",
          color: "#10b981",
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: 6,
        }}
      >
        {v.eyebrow}
      </div>

      {/* Big grade circle, centered */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: 540,
          height: 540,
          borderRadius: 120,
          background: v.gradeColor,
          color: "#ffffff",
          boxShadow: "0 40px 80px -20px rgba(0,0,0,0.3)",
          marginTop: 100,
        }}
      >
        <div style={{ fontSize: 420, fontWeight: 800, lineHeight: 1, marginBottom: -40 }}>{v.grade}</div>
        <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9, letterSpacing: 4 }}>SEO GRADE</div>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          fontSize: 78,
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.1,
          letterSpacing: -3,
          marginTop: 100,
          maxWidth: 920,
          textAlign: "center",
        }}
      >
        {v.headline}
      </div>

      {/* Subhead */}
      <div
        style={{
          display: "flex",
          marginTop: 36,
          fontSize: 36,
          color: "#475569",
          fontWeight: 500,
          maxWidth: 880,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {v.sub}
      </div>

      {/* Spacer */}
      <div style={{ display: "flex", flex: 1 }} />

      {/* CTA + URL at the bottom */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#0f172a",
            color: "#ffffff",
            padding: "32px 60px",
            borderRadius: 20,
            fontSize: 42,
            fontWeight: 700,
          }}
        >
          Get my grade →
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#0f172a",
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          sitebeat.tech
        </div>
      </div>
    </div>
  );
}
