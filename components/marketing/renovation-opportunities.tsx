import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hammer, Wrench, AlertTriangle } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface Recommendation {
  title: string;
  rationale: string;
  complexity: "easy" | "medium" | "hard";
  estCostLowCents: number;
  estCostHighCents: number;
  estValueLiftLowCents: number;
  estValueLiftHighCents: number;
  permitRequired: boolean;
}

interface Props {
  bedroomCount: number;
  bathroomCount: number;
  recommendations: Recommendation[];
  floorplanSourceUrl?: string | null;
}

const COMPLEXITY_VARIANT: Record<Recommendation["complexity"], "default" | "secondary" | "destructive"> = {
  easy: "secondary",
  medium: "default",
  hard: "destructive",
};

function netLiftRange(r: Recommendation): { low: number; high: number } {
  return {
    low: r.estValueLiftLowCents - r.estCostHighCents,
    high: r.estValueLiftHighCents - r.estCostLowCents,
  };
}

export function RenovationOpportunities({
  bedroomCount,
  bathroomCount,
  recommendations,
  floorplanSourceUrl,
}: Props) {
  if (!recommendations.length) return null;

  const totalLow = recommendations.reduce((s, r) => s + netLiftRange(r).low, 0);
  const totalHigh = recommendations.reduce((s, r) => s + netLiftRange(r).high, 0);

  return (
    <section className="container mt-16 max-w-5xl">
      <div className="mb-8">
        <div className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
          Floor plan analysis
        </div>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">
          Renovation opportunities
        </h2>
        <p className="mt-2 text-muted-foreground">
          We analyzed the floor plan and found {recommendations.length} ways to add value.
          Combined upside (after costs):{" "}
          <span className="font-semibold text-emerald-600">
            {formatCents(totalLow)} – {formatCents(totalHigh)}
          </span>
          .
        </p>
        <div className="mt-3 text-xs text-muted-foreground">
          Detected: {bedroomCount} bedroom{bedroomCount === 1 ? "" : "s"} ·{" "}
          {bathroomCount} bath{bathroomCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {recommendations.map((r, i) => {
          const net = netLiftRange(r);
          const positive = net.high > 0;
          return (
            <Card key={i} className="overflow-hidden">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {r.complexity === "easy" ? (
                      <Wrench className="h-4 w-4" />
                    ) : r.complexity === "medium" ? (
                      <Hammer className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={COMPLEXITY_VARIANT[r.complexity]} className="capitalize">
                      {r.complexity}
                    </Badge>
                    {r.permitRequired && <Badge variant="outline">Permit</Badge>}
                  </div>
                </div>
                <h3 className="font-semibold leading-snug">{r.title}</h3>
                <p className="text-sm text-muted-foreground">{r.rationale}</p>
                <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Cost</div>
                    <div className="font-semibold tabular-nums">
                      {formatCents(r.estCostLowCents)}–{formatCents(r.estCostHighCents)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Value lift</div>
                    <div className="font-semibold tabular-nums text-emerald-600">
                      +{formatCents(r.estValueLiftLowCents)}–{formatCents(r.estValueLiftHighCents)}
                    </div>
                  </div>
                </div>
                <div
                  className={
                    "border-t pt-3 text-sm font-semibold tabular-nums " +
                    (positive ? "text-emerald-600" : "text-muted-foreground")
                  }
                >
                  Net upside: {formatCents(net.low)} – {formatCents(net.high)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {floorplanSourceUrl && (
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Estimates from the floor plan included in the listing.
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Estimates are AI-generated and meant as a starting point — confirm with a licensed
        contractor and local appraiser before acting. Costs and value impact vary by zip code,
        permitting, and contractor availability.
      </p>
    </section>
  );
}
