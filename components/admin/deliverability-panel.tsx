import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DeliverabilityMetrics } from "@/lib/admin-metrics";

const BOUNCE_ALERT = 0.05;
const COMPLAINT_ALERT = 0.003;
const UNSUB_ALERT = 0.02;

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function tone(rate: number, threshold: number) {
  return rate > threshold ? "destructive" : "secondary";
}

export function DeliverabilityPanel({ metrics }: { metrics: DeliverabilityMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deliverability (last 24h)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs uppercase">Bounce</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold tabular-nums">{fmtPct(metrics.bounceRate)}</span>
              <Badge variant={tone(metrics.bounceRate, BOUNCE_ALERT)}>
                {metrics.bounceRate > BOUNCE_ALERT ? "alert" : "ok"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase">Complaint</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold tabular-nums">{fmtPct(metrics.complaintRate)}</span>
              <Badge variant={tone(metrics.complaintRate, COMPLAINT_ALERT)}>
                {metrics.complaintRate > COMPLAINT_ALERT ? "alert" : "ok"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase">Unsubs</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold tabular-nums">{fmtPct(metrics.unsubscribeRate)}</span>
              <Badge variant={tone(metrics.unsubscribeRate, UNSUB_ALERT)}>
                {metrics.unsubscribeRate > UNSUB_ALERT ? "alert" : "ok"}
              </Badge>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Per sender domain
          </div>
          <div className="space-y-2 text-sm">
            {metrics.perDomain.length === 0 && (
              <div className="text-muted-foreground">No sends yet.</div>
            )}
            {metrics.perDomain.map((d) => {
              const bounce = d.total ? d.bounces / d.total : 0;
              const complaint = d.total ? d.complaints / d.total : 0;
              return (
                <div
                  key={d.domain}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <span className="font-medium">{d.domain}</span>
                  <span className="flex items-center gap-3 text-xs tabular-nums">
                    <span>{d.total} sent</span>
                    <Badge variant={tone(bounce, BOUNCE_ALERT)}>bounce {fmtPct(bounce)}</Badge>
                    <Badge variant={tone(complaint, COMPLAINT_ALERT)}>
                      complaint {fmtPct(complaint)}
                    </Badge>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Hard stop engages automatically if complaint rate {">"} {fmtPct(COMPLAINT_ALERT)} in the
          last 24 hours.
        </p>
      </CardContent>
    </Card>
  );
}
