"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface Props {
  listingId: string;
  serviceId: string;
  serviceName: string;
}

const BUDGET_BANDS = [
  { id: "<25k", label: "Under $25k" },
  { id: "25-50k", label: "$25–50k" },
  { id: "50-100k", label: "$50–100k" },
  { id: "100k+", label: "$100k+" },
];
const TIMELINES = [
  { id: "asap", label: "ASAP / 0–30 days" },
  { id: "3-months", label: "Next 90 days" },
  { id: "6-months", label: "Next 6 months" },
  { id: "exploring", label: "Just exploring" },
];

export function ContractorLeadForm({ listingId, serviceId, serviceName }: Props) {
  const [pending, startTransition] = React.useTransition();
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [budgetBand, setBudgetBand] = React.useState(BUDGET_BANDS[1].id);
  const [timeline, setTimeline] = React.useState(TIMELINES[1].id);

  if (submitted) {
    return (
      <Card className="border-emerald-500/40">
        <CardContent className="space-y-2 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h3 className="text-lg font-semibold">You're matched.</h3>
          <p className="text-sm text-muted-foreground">
            We'll email you within 24 hours with 2–3 vetted local {serviceName.toLowerCase()}{" "}
            contractors. No charge to you, ever — they pay our referral fee on the back end.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const res = await fetch("/api/contractor-leads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                listingId,
                serviceId,
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
                budgetBand,
                timeline,
              }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error ?? `Submit failed (${res.status})`);
            }
            setSubmitted(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong");
          }
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          disabled={pending}
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          disabled={pending}
        />
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional, faster match)"
          disabled={pending}
          className="sm:col-span-2"
        />
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Budget
        </div>
        <div className="flex flex-wrap gap-2">
          {BUDGET_BANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBudgetBand(b.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                budgetBand === b.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Timeline
        </div>
        <div className="flex flex-wrap gap-2">
          {TIMELINES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeline(t.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                timeline === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Submitting…" : `Match me with ${serviceName} contractors`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        We'll send 2–3 vetted local introductions within 24 hours. The mockup and the
        introductions are free — contractors pay our referral fee, your quote is unchanged.
      </p>
    </form>
  );
}
