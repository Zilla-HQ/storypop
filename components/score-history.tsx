import { db, audits } from "@/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { letterGrade, gradeColor } from "@/lib/grade";

/**
 * Score-history sparkline for a site. Pulls every completed audit run
 * for the site, sorted oldest-first, and renders an SVG line chart with
 * the latest grade overlay. Server component — no JS needed.
 */
export async function ScoreHistory({ siteId }: { siteId: string }) {
  const runs = await db
    .select({
      score: audits.score,
      runAt: audits.runAt,
      createdAt: audits.createdAt,
    })
    .from(audits)
    .where(and(eq(audits.siteId, siteId), eq(audits.status, "complete")))
    .orderBy(asc(audits.runAt))
    .limit(52); // ~1 year of weekly audits

  if (runs.length < 2) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        Not enough audit history yet — check back next Monday after the weekly cron runs.
      </div>
    );
  }

  const valid = runs.filter((r): r is { score: number; runAt: Date | null; createdAt: Date } =>
    typeof r.score === "number",
  );
  if (valid.length < 2) return null;

  const W = 600;
  const H = 140;
  const PAD_X = 24;
  const PAD_Y = 16;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const points = valid.map((r, i) => {
    const x = PAD_X + (i / (valid.length - 1)) * innerW;
    // Score 0..100 → flipped Y (100 = top)
    const y = PAD_Y + ((100 - r.score) / 100) * innerH;
    return { x, y, score: r.score, runAt: r.runAt ?? r.createdAt };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${(H - PAD_Y).toFixed(1)} L ${points[0].x.toFixed(1)} ${(H - PAD_Y).toFixed(1)} Z`;

  const latest = points[points.length - 1];
  const grade = letterGrade(latest.score);
  const color = gradeColor(grade);
  const previous = points[points.length - 2];
  const delta = latest.score - previous.score;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold">Score history ({valid.length} runs)</h3>
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-mono tabular-nums">{latest.score}</span>
          <span
            className={`font-medium ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta} vs last
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Score history showing ${valid.length} audit runs`}
      >
        {/* y-axis grid lines at 0/50/100 */}
        {[0, 50, 100].map((y) => {
          const yPos = PAD_Y + ((100 - y) / 100) * innerH;
          return (
            <g key={y}>
              <line
                x1={PAD_X}
                y1={yPos}
                x2={W - PAD_X}
                y2={yPos}
                stroke="#e2e8f0"
                strokeDasharray="2 4"
              />
              <text
                x={PAD_X - 4}
                y={yPos + 4}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
              >
                {y}
              </text>
            </g>
          );
        })}
        {/* area + line */}
        <path d={areaPath} fill={color} fillOpacity="0.12" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? color : "#ffffff"}
            stroke={color}
            strokeWidth="1.5"
          >
            <title>
              {p.runAt.toISOString().slice(0, 10)}: {p.score}/100
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
