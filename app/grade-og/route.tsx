import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Dynamic OG image for shared grader results.
 *
 *   /grade-og?score=87&letter=B&title=Sunset+Loft&city=Nashville
 *
 * Used by `/grade/share` page metadata so Twitter/Facebook/iMessage previews
 * render the score visually instead of the bare site name. The score is
 * passed in the URL so the OG endpoint never has to re-run the (expensive)
 * grader — the share page that knows the score generates the OG URL with
 * the right query params baked in.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scoreRaw = searchParams.get("score") ?? "0";
  const score = Math.max(0, Math.min(100, parseInt(scoreRaw, 10) || 0));
  const letter = (searchParams.get("letter") ?? "F").slice(0, 1).toUpperCase();
  const title = (searchParams.get("title") ?? "Airbnb listing").slice(0, 80);
  const city = (searchParams.get("city") ?? "").slice(0, 50);

  const accent = colorForLetter(letter);

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
              fontSize: 22,
              color: "#64748b",
              fontWeight: 500,
            }}
          >
            Free Airbnb listing grader
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 320,
              height: 320,
              borderRadius: 40,
              background: accent.bg,
              border: `4px solid ${accent.border}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 220, fontWeight: 800, color: accent.text, lineHeight: 1 }}>
              {letter}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                fontWeight: 700,
                color: accent.text,
                letterSpacing: "0.08em",
              }}
            >
              {score}/100
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#475569",
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              Listing graded
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 50,
                color: "#0f172a",
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: 14,
              }}
            >
              {title}
            </div>
            {city && (
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                {city}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 30,
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
            Grade your listing free at restay.agency/grade
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#0f172a",
              fontWeight: 600,
            }}
          >
            10 seconds · No signup
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function colorForLetter(
  letter: string,
): { bg: string; border: string; text: string } {
  switch (letter) {
    case "A":
      return { bg: "#d1fae5", border: "#10b981", text: "#047857" };
    case "B":
      return { bg: "#ecfccb", border: "#84cc16", text: "#4d7c0f" };
    case "C":
      return { bg: "#fef3c7", border: "#f59e0b", text: "#b45309" };
    case "D":
      return { bg: "#fed7aa", border: "#f97316", text: "#c2410c" };
    case "F":
    default:
      return { bg: "#fecaca", border: "#ef4444", text: "#b91c1c" };
  }
}
