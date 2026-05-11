"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminSettings } from "@/db";
import { updatePauseFlag } from "@/app/admin/actions";

const AGENTS = [
  { key: "paused", label: "Global pause" },
  { key: "discoveryPaused", label: "Discovery" },
  { key: "qualificationPaused", label: "Qualification" },
  { key: "previewPaused", label: "Preview" },
  { key: "outreachPaused", label: "Outreach" },
  { key: "fulfillmentPaused", label: "Fulfillment" },
  { key: "followupPaused", label: "Follow-up" },
] as const;

export function PauseControls({ settings }: { settings: AdminSettings }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {AGENTS.map((a) => {
          const isPaused = settings[a.key] as boolean;
          return (
            <div key={a.key} className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">{a.label}</span>
              <form
                action={() => {
                  startTransition(async () => {
                    await updatePauseFlag(a.key, !isPaused);
                  });
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  variant={isPaused ? "default" : "outline"}
                  disabled={pending}
                >
                  {isPaused ? "Resume" : "Pause"}
                </Button>
              </form>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
