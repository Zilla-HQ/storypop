"use client";

import { useTransition, useState } from "react";
import { setPause } from "@/app/admin/actions";

export function PauseToggle({
  label,
  hint,
  field,
  initial,
}: {
  label: string;
  hint?: string;
  field: "paused" | "monitoringPaused" | "discoveryPaused";
  initial: boolean;
}) {
  const [paused, setPaused] = useState(initial);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const next = !paused;
    setPaused(next);
    startTransition(async () => {
      await setPause(field, next);
    });
  };

  return (
    <div className="flex items-start justify-between gap-6 rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={
          "h-6 w-11 shrink-0 rounded-full border transition " +
          (paused ? "bg-amber-500" : "bg-emerald-500")
        }
        aria-pressed={paused}
      >
        <span
          className={
            "block h-5 w-5 rounded-full bg-white transition " +
            (paused ? "translate-x-5" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}
