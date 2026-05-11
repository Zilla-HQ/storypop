import { inngest } from "@/inngest/client";
import { runMentionsHandler } from "@/lib/x-mentions-handler";
import { getSettings } from "@/db/settings";

/**
 * Poll for @brand-account mentions on X every 30 minutes. For each new
 * mention, Claude evaluates whether to reply and drafts the response.
 * If yes, we post via the X API; either way the decision is logged to
 * x_mentions for audit.
 *
 * Cost guardrails baked into the handler:
 *   - 5 replies max per run by default (X_MENTIONS_MAX_REPLIES_PER_RUN)
 *   - sinceId watermark in admin_settings — never re-process a mention
 *
 * Operator overrides: trigger manually via the `x-mentions/poll` event
 * (e.g. from /admin/x).
 *
 * Pre-conditions:
 *   - X_CLIENT_ID + X_CLIENT_SECRET set (HQ-shared)
 *   - ANTHROPIC_API_KEY set
 *   - Operator has visited /api/auth/x/start once for the brand account
 */
export const xMentionsPollFn = inngest.createFunction(
  {
    id: "x-mentions-poll",
    name: "X — auto-reply to mentions",
    retries: 1,
    concurrency: { limit: 1 },
  },
  [{ cron: "*/30 * * * *" }, { event: "x-mentions/poll" }],
  async ({ step, logger }) => {
    const settings = await step.run("settings", () => getSettings());
    if (settings.paused) return { skipped: true, reason: "paused" };

    if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) {
      return { skipped: true, reason: "x credentials missing" };
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return { skipped: true, reason: "anthropic key missing" };
    }
    if (!settings.xRefreshToken) {
      return { skipped: true, reason: "brand account not authorized — visit /api/auth/x/start" };
    }

    const result = await step.run("run", () => runMentionsHandler());
    logger.info("X mentions handler complete", result);
    return result;
  },
);
