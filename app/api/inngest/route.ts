import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

import { generatePreview } from "@/inngest/functions/preview";
import { fulfillment } from "@/inngest/functions/fulfillment";
import { abandonedCartFn } from "@/inngest/functions/abandoned-cart";
import { photoPurgeFn } from "@/inngest/functions/photo-purge";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generatePreview, fulfillment, abandonedCartFn, photoPurgeFn],
});
