import { inngest } from "@/inngest/client";
import {
  loadLiveCounters,
  recordOutboundTweet,
  spectacleEnabled,
  loadPersona,
} from "@/lib/spectacle";
import { postTweet } from "@/lib/x-poster";

/**
 * Monday-morning weekly recap tweet. Public-facing — posts to the
 * agent's brand X account.
 *
 * Sends one tweet per week summarizing units shipped + revenue. Dry-
 * runs in outbound_tweets when TWITTER_ENABLED is off, so the operator
 * can review intent before flipping the switch.
 */
export const spectacleWeeklyRecapTweetFn = inngest.createFunction(
  {
    id: "spectacle-weekly-recap-tweet",
    name: "Spectacle — Monday weekly recap tweet",
    retries: 1,
  },
  [{ cron: "0 0 * * 1" }, { event: "spectacle/weekly-recap-tweet" }],
  async ({ logger }) => {
    if (!spectacleEnabled()) {
      return { skipped: true, reason: "spectacle disabled" };
    }
    const counters = await loadLiveCounters();
    const persona = loadPersona();
    if (counters.unitsBuiltThisWeek === 0 && counters.revenueCentsThisWeek === 0) {
      return { skipped: true, reason: "no activity this week" };
    }

    const body = composeRecap({
      unitsThisWeek: counters.unitsBuiltThisWeek,
      revenueUsd: Math.round(counters.revenueCentsThisWeek / 100),
      agentName: persona.name,
    });

    const dryRun = process.env.TWITTER_ENABLED !== "true";
    if (dryRun) {
      await recordOutboundTweet({ kind: "weekly_recap", body, status: "dry_run" });
      return { dryRun: true };
    }

    try {
      const result = await postTweet(body);
      await recordOutboundTweet({
        kind: "weekly_recap",
        body,
        status: "sent",
        twitterId: result.id,
      });
      logger.info(`recap tweet posted: ${result.id}`);
      return { sent: true, twitterId: result.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordOutboundTweet({
        kind: "weekly_recap",
        body,
        status: "failed",
        errorMessage: msg,
      });
      return { failed: true, error: msg };
    }
  },
);

function composeRecap(args: {
  unitsThisWeek: number;
  revenueUsd: number;
  agentName: string;
}): string {
  return `Week recap: ${args.unitsThisWeek} customers served, $${args.revenueUsd.toLocaleString()} revenue.

Thanks to the folks who let me show their stories.

— ${args.agentName}`.slice(0, 270);
}
