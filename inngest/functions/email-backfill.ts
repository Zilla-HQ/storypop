import { inngest } from "@/inngest/client";
import { backfillMissingEmails } from "@/lib/email-backfill";
import { getSettings } from "@/db/settings";

/**
 * Walk sites that don't yet have a customer_email, scrape the
 * homepage for one, MX-validate, persist, and re-fire an audit so
 * the report email goes out. Caps at 50 sites per run.
 *
 * No cron — this is event-only. Triggered manually from /admin or
 * fired immediately after deploy. Once the initial backlog is
 * drained, the cold-outreach pipeline keeps email-finding inline at
 * discovery time, so this rarely needs re-running.
 */
export const emailBackfillFn = inngest.createFunction(
  {
    id: "email-backfill",
    name: "Email-discovery backfill (sites missing customer_email)",
    retries: 1,
    concurrency: { limit: 1 },
  },
  { event: "email-backfill/sweep" },
  async ({ step, logger }) => {
    const settings = await step.run("settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    const result = await step.run("backfill", () => backfillMissingEmails(50));
    logger.info("Email backfill complete", result);
    return result;
  },
);
