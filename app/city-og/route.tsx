import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Shared OG image for /grade/[city] (type=grade) and /host/[city] (type=host).
 *   /city-og?city=Nashville&state=TN&type=grade&signal=rooftop
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") ?? "your city").slice(0, 40);
  const state = (searchParams.get("state") ?? "").slice(0, 4);
  const type = searchParams.get("type") === "host" ? "host" : "grade";
  const signal = (searchParams.get("signal") ?? "").slice(0, 80);

  const headline =
    type === "host"
      ? `Tune up your ${city} Airbnb listing`
      : `Grade your ${city} Airbnb listing`;
  const sub =
    type === "host"
      ? `Rewrite, restyle, reprice — $79 one-time. Delivered in under 4 hours.`
      : `Free 0–100 score across photos, copy, and signals. 10 seconds, no signup.`;
  const accent = type === "host" ? "#0f172a" : "#047857";
  const accentBg = type === "host" ? "#fef3c7" : "#d1fae5";
  const ribbon = type === "host" ? "DONE-FOR-YOU TUNE-UP" : "FREE LISTING GRADER";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)",
          padding: "70px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "#0f172a",
            }}
          >
            RESTAY
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: accent,
              fontWeight: 700,
              padding: "10px 18px",
              borderRadius: 999,
              background: accentBg,
              letterSpacing: "0.1em",
            }}
          >
            {ribbon}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: "#475569",
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            {state ? `${city.toUpperCase()}, ${state.toUpperCase()}` : city.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#475569",
              fontWeight: 500,
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            {sub}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 26,
            borderTop: "1px solid #cbd5e1",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#475569",
              fontWeight: 500,
              maxWidth: 900,
            }}
          >
            {signal ? `Lead signal: ${signal}` : "restay.agency"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#0f172a",
              fontWeight: 600,
            }}
          >
            {type === "host" ? "$79 · 4 hours" : "Free · 10 seconds"}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
