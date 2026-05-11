import { inngest } from "@/inngest/client";
import { runFollowupSweep } from "@/lib/cold-followup";
import { getSettings } from "@/db/settings";

/**
 * Daily cold-outbound follow-up sweep. Finds leads who got an audit
 * report email N days ago, no reply, no subscription, and sends the
 * appropriate stage follow-up (day-2 nudge / day-5 discount / day-10
 * break-up). Idempotent — already-sent stages are skipped.
 *
 * Schedule: 15:00 UTC daily (= 11:00 ET, 8:00 PT — early business
 * hours window for US recipients to see the email when they open
 * email in the morning). Runs after the 14:00 UTC weekly-audit
 * dispatcher so we don't compete for Resend send capacity.
 *
 * Manual trigger: send `cold-followup/sweep` event from /admin to
 * backfill — first run on a stale lead pool will fire ~all day-10
 * break-up emails since most existing audits are >7 days old.
 */
export const coldFollowupSweepFn = inngest.createFunction(
  {
    id: "cold-followup-sweep",
    name: "Cold outbound — multi-touch follow-up sweep",
    retries: 2,
    // Modest concurrency: the sweep itself is sequential (avoid
    // hammering Resend), and we don't want two sweeps overlapping.
    concurrency: { limit: 1 },
  },
  [{ cron: "0 15 * * *" }, { event: "cold-followup/sweep" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) {
      logger.info("Cold follow-up sweep skipped: platform paused");
      return { skipped: true, reason: "paused" };
    }
    if (settings.discoveryPaused) {
      logger.info("Cold follow-up sweep skipped: discovery paused");
      return { skipped: true, reason: "discovery_paused" };
    }

    const result = await step.run("run-sweep", () => runFollowupSweep());
    logger.info("Cold follow-up sweep complete", result);
    return result;
  },
);
