import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Dynamic OG image for /blog/[slug] pages.
 *   /blog-og?title=...&category=...&minutes=8
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "Restay Journal").slice(0, 110);
  const category = (searchParams.get("category") ?? "Article").slice(0, 30);
  const minutes = (searchParams.get("minutes") ?? "").slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
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
            RESTAY · JOURNAL
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#475569",
              fontWeight: 600,
              padding: "8px 18px",
              borderRadius: 999,
              background: "#e0e7ff",
            }}
          >
            {category.toUpperCase()}
            {minutes ? ` · ${minutes} MIN` : ""}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
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
            }}
          >
            Specific advice on Airbnb listing optimization
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#0f172a",
              fontWeight: 600,
            }}
          >
            restay.agency/blog
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
