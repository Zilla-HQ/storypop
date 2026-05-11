"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdminSettings } from "@/db";
import { updatePricing } from "@/app/admin/actions";

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    standard: (settings.pricingStandardCents / 100).toString(),
    premium: (settings.pricingPremiumCents / 100).toString(),
    rush: (settings.pricingRushCents / 100).toString(),
    dailySendCap: settings.dailySendCap.toString(),
    previewDailyCap: settings.previewDailyCap.toString(),
    fulfillmentBudget: (settings.fulfillmentDailyBudgetCents / 100).toString(),
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await updatePricing({
            standardCents: Math.round(Number(form.standard) * 100),
            premiumCents: Math.round(Number(form.premium) * 100),
            rushCents: Math.round(Number(form.rush) * 100),
            dailySendCap: Number(form.dailySendCap),
            previewDailyCap: Number(form.previewDailyCap),
            fulfillmentDailyBudgetCents: Math.round(Number(form.fulfillmentBudget) * 100),
          });
          setStatus("saved");
          setTimeout(() => setStatus(null), 2000);
        });
      }}
    >
      <Field label="Standard ($)">
        <Input
          type="number"
          value={form.standard}
          onChange={(e) => setForm({ ...form, standard: e.target.value })}
        />
      </Field>
      <Field label="Premium ($)">
        <Input
          type="number"
          value={form.premium}
          onChange={(e) => setForm({ ...form, premium: e.target.value })}
        />
      </Field>
      <Field label="Rush ($)">
        <Input
          type="number"
          value={form.rush}
          onChange={(e) => setForm({ ...form, rush: e.target.value })}
        />
      </Field>
      <Field label="Daily send cap">
        <Input
          type="number"
          value={form.dailySendCap}
          onChange={(e) => setForm({ ...form, dailySendCap: e.target.value })}
        />
      </Field>
      <Field label="Preview daily cap">
        <Input
          type="number"
          value={form.previewDailyCap}
          onChange={(e) => setForm({ ...form, previewDailyCap: e.target.value })}
        />
      </Field>
      <Field label="Fulfillment daily budget ($)">
        <Input
          type="number"
          value={form.fulfillmentBudget}
          onChange={(e) => setForm({ ...form, fulfillmentBudget: e.target.value })}
        />
      </Field>
      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
