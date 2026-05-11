import { ImageResponse } from "next/og";

/**
 * Site-wide default Open Graph + Twitter card image. Generated on
 * the edge — no static asset to manage. Renders the Restay logotype,
 * one-line value prop, and the FLASH50 callout for the duration of
 * launch week. After 2026-05-08 18:53 UTC the FLASH50 callout
 * would still render here even though the coupon is dead — keeping
 * it static is a forgivable evergreen-vs-precision trade for now.
 */
export const runtime = "edge";
export const alt = "Restay — AI listing tune-up for Airbnb hosts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "70px 80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            R
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Restay
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            Free Airbnb listing grader.<br />
            <span style={{ color: "#10b981" }}>$79 one-time</span> Tune-Up.
          </div>
          <div style={{ fontSize: 28, color: "#94a3b8", maxWidth: 1000 }}>
            Rewritten copy, 10 restyled photos, 30-day pricing report — delivered in under 4 hours.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#cbd5e1",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              background: "#10b981",
              color: "#0f172a",
              borderRadius: 8,
              fontWeight: 800,
            }}
          >
            FLASH50
          </div>
          <div>50% off this week — first 10 customers · restay.agency</div>
        </div>
      </div>
    ),
    size,
  );
}
