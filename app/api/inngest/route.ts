import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

import { generatePreview } from "@/inngest/functions/preview";
import { fulfillment } from "@/inngest/functions/fulfillment";
import { abandonedCartFn } from "@/inngest/functions/abandoned-cart";
import { orderStuckWatchdogFn } from "@/inngest/functions/order-stuck-watchdog";
import { previewStuckWatchdogFn } from "@/inngest/functions/preview-stuck-watchdog";
import { pendingOrderWatchdogFn } from "@/inngest/functions/pending-order-watchdog";

export const runtime = "nodejs";
// fal.ai LoRA training + page rendering can stretch past 60s; cap at Vercel Pro max.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generatePreview,
    fulfillment,
    abandonedCartFn,
    orderStuckWatchdogFn,
    previewStuckWatchdogFn,
    pendingOrderWatchdogFn,
  ],
});
