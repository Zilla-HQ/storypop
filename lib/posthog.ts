import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = env("POSTHOG_PROJECT_API_KEY") ?? env("NEXT_PUBLIC_POSTHOG_KEY");
  if (!key) return null;
  if (client) return client;
  client = new PostHog(key, {
    host: env("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com")!,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export async function trackEvent(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const c = getClient();
  if (!c) return;
  c.capture({
    distinctId: args.distinctId,
    event: args.event,
    properties: args.properties,
  });
  // Best-effort flush; never throw from observability code
  try {
    await c.flush();
  } catch {
    // swallow
  }
}
