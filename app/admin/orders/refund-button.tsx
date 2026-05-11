"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { refundOrder } from "@/app/admin/actions";

export function RefundButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm("Refund this order? This cannot be undone.")) return;
          startTransition(async () => {
            const r = await refundOrder(orderId);
            setMsg(r.ok ? "refunded" : r.error ?? "error");
          });
        }}
      >
        {pending ? "…" : "Refund"}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
