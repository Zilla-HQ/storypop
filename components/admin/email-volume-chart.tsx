import type { DailyVolume } from "@/lib/resend-stats";

/**
 * 14-day daily-volume sparkline. Server component, pure SVG, no JS.
 */
export function EmailVolumeChart({ data }: { data: DailyVolume[] }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 600;
  const H = 80;
  const PAD = 12;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const barW = innerW / data.length - 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Daily email volume">
      {data.map((d, i) => {
        const x = PAD + (innerW / data.length) * i + 1;
        const h = (d.count / max) * innerH;
        const y = PAD + innerH - h;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={d.count === 0 ? "#e2e8f0" : "#10b981"}
              rx={2}
            >
              <title>
                {d.date}: {d.count} email{d.count === 1 ? "" : "s"}
              </title>
            </rect>
          </g>
        );
      })}
      {/* x-axis label: first + last date */}
      <text x={PAD} y={H - 1} fontSize="9" fill="#94a3b8">
        {data[0].date.slice(5)}
      </text>
      <text x={W - PAD - 30} y={H - 1} fontSize="9" fill="#94a3b8" textAnchor="end">
        {data[data.length - 1].date.slice(5)}
      </text>
    </svg>
  );
}
