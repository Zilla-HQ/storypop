import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FunnelProps {
  stages: { label: string; count: number }[];
}

export function Funnel({ stages }: FunnelProps) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].count : s.count;
          const conversion = prev > 0 ? ((s.count / prev) * 100).toFixed(1) : "–";
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.count}{" "}
                  {i > 0 && (
                    <span className="ml-2 text-xs">
                      ({conversion === "–" ? "–" : `${conversion}%`})
                    </span>
                  )}
                </span>
              </div>
              <Progress value={s.count} max={max} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
