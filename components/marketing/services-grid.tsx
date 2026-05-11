import Link from "next/link";
import { Sofa, Trees, SunMedium, Sparkles, Building2, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SERVICES, servicesForAudience, type Audience } from "@/lib/services";
import { formatCents } from "@/lib/utils";

const ICONS = { Sofa, Trees, SunMedium, Sparkles, Building2, Waves } as const;

export function ServicesGrid({
  compact = false,
  audience,
}: {
  compact?: boolean;
  audience?: Audience;
}) {
  const services = audience ? servicesForAudience(audience) : SERVICES;
  return (
    <div className={`grid gap-4 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}>
      {services.map((s) => {
        const Icon = ICONS[s.icon];
        const free = s.basePriceCents === 0;
        return (
          <Link
            key={s.id}
            href={`/services/${s.id}`}
            className="block transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  {free ? (
                    <Badge variant="success">Free preview</Badge>
                  ) : (
                    <Badge variant="secondary">{formatCents(s.basePriceCents)}</Badge>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold leading-tight">{s.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.shortDescription}</p>
                </div>
                <div className="mt-auto pt-2 text-xs font-medium text-primary">
                  {s.ctaPrimary} →
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
