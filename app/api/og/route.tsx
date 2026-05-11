import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Dynamic OG image generator at /api/og.
 *
 * Pages call this with `?title=...&kicker=...` to render a 1200×630
 * PNG with consistent merchant branding for social shares.
 *
 *   /api/og?title=Free%20Audit&kicker=Brand
 *
 * Tune the gradient + colors below per merchant. Keep dimensions
 * (1200×630) — that's what Twitter/Meta/LinkedIn/Slack expect.
 */

const BRAND_NAME = process.env.BUSINESS_NAME ?? "Brand";

// Brand palette — change these two hex values to re-skin the OG card.
const BG_FROM = "#0c4a6e"; // dark
const BG_TO = "#0369a1"; // mid
const ACCENT = "#0ea5e9"; // for the brand chip

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? BRAND_NAME).slice(0, 200);
  const kicker = (searchParams.get("kicker") ?? "").slice(0, 80);
  const tagline = (searchParams.get("tagline") ?? "").slice(0, 80);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${BG_FROM} 0%, ${BG_TO} 100%)`,
          padding: "80px",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {kicker ? (
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              opacity: 0.85,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            {kicker}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            wordBreak: "break-word",
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {title}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "white",
                color: ACCENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {BRAND_NAME[0]?.toUpperCase() ?? "B"}
            </div>
            <span>{BRAND_NAME}</span>
          </div>
          {tagline ? (
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                opacity: 0.85,
              }}
            >
              {tagline}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
