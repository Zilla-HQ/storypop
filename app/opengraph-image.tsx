import { ImageResponse } from "next/og";

/**
 * Site-wide default Open Graph + Twitter card image. Generated on
 * the edge — no static asset to manage. Renders the StoryPop wordmark
 * and the headline value prop.
 */
export const runtime = "edge";
export const alt = "StoryPop — a book where your kid is the hero";
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
          background: "linear-gradient(135deg, #FFF8F0 0%, #FFD166 100%)",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#FF6B9D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "#FFF8F0",
            }}
          >
            S
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>
            StoryPop
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
            A book where<br />
            <span style={{ color: "#FF6B9D" }}>your kid is the hero.</span>
          </div>
          <div style={{ fontSize: 28, color: "#475569", maxWidth: 1000 }}>
            Personalized illustrated stories — PDF, softcover, or hardcover.
            Delivered in about five minutes (PDF) or 5-10 days (print).
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#475569" }}>
          storypop.shop
        </div>
      </div>
    ),
    size,
  );
}
