import { inngest } from "@/inngest/client";
import { loadDiaryEntries, diaryTweetAlreadySent, recordOutboundTweet, spectacleEnabled, loadPersona } from "@/lib/spectacle";
import { postTweet } from "@/lib/x-poster";

/**
 * Diary-publish auto-tweet — hourly cron.
 *
 * Walks content/diary/*.md, finds the most recent entry not yet tweeted,
 * and posts a short tweet linking to it. Idempotent via the
 * outbound_tweets.diarySlug column (one row per slug, ever).
 *
 * Gated on TWITTER_ENABLED=true. When disabled, still records the
 * intended tweet with status='dry_run' so the operator can review
 * before flipping the switch.
 */
export const diaryPublishTweetFn = inngest.createFunction(
  {
    id: "diary-publish-tweet",
    name: "Spectacle — diary auto-tweet",
    retries: 1,
  },
  [{ cron: "15 * * * *" }, { event: "diary/publish-tweet" }],
  async ({ logger }) => {
    if (!spectacleEnabled()) {
      return { skipped: true, reason: "spectacle disabled" };
    }
    const entries = await loadDiaryEntries();
    if (entries.length === 0) return { skipped: true, reason: "no entries" };
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").replace(/\/$/, "");
    const persona = loadPersona();

    for (const e of entries) {
      if (await diaryTweetAlreadySent(e.slug)) continue;
      const url = `${appUrl}/diary/${e.slug}`;
      const body = composeDiaryTweet({ title: e.title, url, agentName: persona.name });
      const dryRun = process.env.TWITTER_ENABLED !== "true";
      if (dryRun) {
        await recordOutboundTweet({
          kind: "diary",
          body,
          diarySlug: e.slug,
          status: "dry_run",
        });
        return { dryRun: true, slug: e.slug };
      }
      try {
        const result = await postTweet(body);
        await recordOutboundTweet({
          kind: "diary",
          body,
          diarySlug: e.slug,
          status: "sent",
          twitterId: result.id,
        });
        logger.info(`diary tweet posted: ${e.slug} → ${result.id}`);
        return { sent: true, slug: e.slug, twitterId: result.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordOutboundTweet({
          kind: "diary",
          body,
          diarySlug: e.slug,
          status: "failed",
          errorMessage: msg,
        });
        logger.error(`diary tweet failed: ${e.slug}`, err);
        return { failed: true, slug: e.slug, error: msg };
      }
    }
    return { skipped: true, reason: "all entries already tweeted" };
  },
);

function composeDiaryTweet(args: { title: string; url: string; agentName: string }): string {
  // Persona note: terse, one line, no emoji, signed by the agent.
  // 240 chars max (270 cap minus 30-char URL buffer).
  const base = `New journal entry: ${args.title}\n\n${args.url}\n\n— ${args.agentName}`;
  if (base.length <= 270) return base;
  const room = 270 - (`\n\n${args.url}\n\n— ${args.agentName}`.length);
  return `New: ${args.title.slice(0, room - 5)}\n\n${args.url}\n\n— ${args.agentName}`;
}
