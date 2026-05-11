"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

export type Tier = "standard" | "premium" | "rush";

interface PricingProps {
  pricing: { standard: number; premium: number; rush: number };
  // Interactive mode: tier-selector callback (e.g. /l/<slug> checkout flow).
  onSelect?: (tier: Tier) => void;
  loadingTier?: Tier | null;
  selectedTier?: Tier;
  // Static-link mode: render the CTAs as anchor tags pointing at the same
  // href. Used by SEO landing pages (/agents, /curb-appeal/[city], etc.)
  // that don't have a per-tier checkout flow on the page itself — the user
  // clicks the CTA, lands on the live preview /l/<slug>, then picks a tier
  // there. Pass `ctaHref` to opt in; `ctaLabel` overrides the default copy.
  ctaHref?: string;
  ctaLabel?: string;
}

export function Pricing({
  pricing,
  onSelect,
  loadingTier,
  selectedTier,
  ctaHref,
  ctaLabel,
}: PricingProps) {
  const tiers: {
    id: Tier;
    title: string;
    price: number;
    turnaround: string;
    includes: string[];
    highlight?: boolean;
  }[] = [
    {
      id: "standard",
      title: "Standard",
      price: pricing.standard,
      turnaround: "Under 2 hours",
      includes: ["12–15 enhanced photos", "One style preset", "NAR-compliant disclosure", "Full refund if you don't love it"],
    },
    {
      id: "premium",
      title: "Premium",
      price: pricing.premium,
      turnaround: "Under 2 hours",
      highlight: true,
      includes: [
        "Every photo in the listing",
        "Four style options to compare",
        "Sky replacement + twilight on exteriors",
        "Shareable gallery link",
      ],
    },
    {
      id: "rush",
      title: "Rush + Premium",
      price: pricing.rush,
      turnaround: "Under 30 minutes",
      includes: ["Everything in Premium", "Priority queue", "Rush delivery under 30 min", "SMS on delivery"],
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {tiers.map((t) => (
        <Card
          key={t.id}
          className={cn(
            "flex flex-col",
            t.highlight && "border-primary shadow-lg",
            selectedTier === t.id && "ring-2 ring-primary",
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t.title}</CardTitle>
              {t.highlight && <Badge>Most popular</Badge>}
            </div>
            <CardDescription>{t.turnaround}</CardDescription>
            <div className="pt-2 text-3xl font-bold">{formatCents(t.price)}</div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {t.includes.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {ctaHref ? (
              <Button asChild size="lg" variant={t.highlight ? "default" : "outline"} className="mt-auto">
                <a href={ctaHref}>{ctaLabel ?? `Choose ${t.title}`}</a>
              </Button>
            ) : (
              <Button
                onClick={() => onSelect?.(t.id)}
                disabled={loadingTier !== null && loadingTier !== undefined}
                size="lg"
                variant={t.highlight ? "default" : "outline"}
                className="mt-auto"
              >
                {loadingTier === t.id ? "Redirecting…" : `Choose ${t.title}`}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
