import { inngest } from "@/inngest/client";
import { runSeoBootstrap } from "@/lib/seo/bootstrap";
import { getSettings } from "@/db/settings";

/**
 * Per-merchant SEO bootstrap. Adds the merchant URL as a property in
 * Google Search Console + Bing Webmaster, submits the sitemap, and
 * pings IndexNow with every URL. Fully idempotent — re-running is a
 * no-op.
 *
 * Triggers:
 *   - Daily cron at 04:00 UTC. Cheap insurance against any merchant
 *     where the manual trigger never fired.
 *   - Manual `seo/bootstrap` event from /admin/seo button or first-
 *     deploy hook.
 *
 * Pre-conditions (ZILLA_HQ_SETUP.md §1–§3):
 *   - zilla.so verified as Domain property in GSC + Bing
 *   - HQ OAuth credentials in env (ZILLA_GSC_OAUTH_*)
 *   - HQ Bing API key in env (ZILLA_BING_WEBMASTER_API_KEY)
 *   - Merchant has run scripts/generate-indexnow-key.mjs and deployed
 *     so the IndexNow key file is reachable
 */
export const seoBootstrapFn = inngest.createFunction(
  {
    id: "seo-bootstrap",
    name: "SEO — register with GSC + Bing + IndexNow",
    retries: 3,
  },
  // Daily at 04:00 UTC, plus manual trigger.
  [{ cron: "0 4 * * *" }, { event: "seo/bootstrap" }],
  async ({ step, logger }) => {
    const settings = await step.run("load-settings", () => getSettings());
    if (settings.paused) {
      logger.info("SEO bootstrap skipped: platform paused");
      return { skipped: true, reason: "paused" };
    }

    // Check that the HQ creds are wired. If not, this is a no-op
    // until HQ provisioning is complete (see ZILLA_HQ_SETUP.md).
    const hasGscCreds = Boolean(
      process.env.ZILLA_GSC_OAUTH_CLIENT_ID &&
        process.env.ZILLA_GSC_OAUTH_CLIENT_SECRET &&
        (process.env.ZILLA_GSC_OAUTH_REFRESH_TOKEN ??
          process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN),
    );
    const hasBingCreds = Boolean(process.env.ZILLA_BING_WEBMASTER_API_KEY);

    if (!hasGscCreds && !hasBingCreds) {
      logger.warn(
        "SEO bootstrap: no HQ credentials configured. Set ZILLA_GSC_OAUTH_* and/or ZILLA_BING_WEBMASTER_API_KEY in Vercel env. See ZILLA_HQ_SETUP.md.",
      );
      return { skipped: true, reason: "no-hq-credentials" };
    }

    const result = await step.run("run-bootstrap", () => runSeoBootstrap());
    logger.info("SEO bootstrap finished", { steps: result.steps });
    return result;
  },
);
