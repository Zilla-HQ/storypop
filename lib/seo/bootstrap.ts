import * as gsc from "@/lib/seo/google-search-console";
import * as bing from "@/lib/seo/bing-webmaster";
import * as indexNow from "@/lib/seo/indexnow";

/**
 * Orchestrates the full per-merchant SEO bootstrap. Idempotent — safe
 * to run on every deploy or every cron tick. Each step is wrapped in
 * try/catch so a single API failure doesn't block the others.
 *
 * Triggered by:
 *   - inngest/functions/seo-bootstrap.ts (cron + manual event)
 *   - app/api/admin/seo/route.ts (operator-clicks-button override)
 *
 * Pre-conditions (do these once at HQ — see ZILLA_HQ_SETUP.md):
 *   - zilla.so is verified as a Domain property in GSC
 *   - zilla.so is verified in Bing Webmaster
 *   - HQ OAuth refresh token + Bing API key are in env
 *   - The merchant has run scripts/generate-indexnow-key.mjs and
 *     deployed (so /<key>.txt is reachable)
 */

export interface BootstrapResult {
  appUrl: string;
  steps: Array<{
    name: string;
    status: "ok" | "skipped" | "error";
    detail?: string;
  }>;
  startedAt: string;
  finishedAt: string;
}

function appUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!u) throw new Error("NEXT_PUBLIC_APP_URL not set");
  return u.replace(/\/$/, "") + "/";
}

export async function runSeoBootstrap(): Promise<BootstrapResult> {
  const startedAt = new Date().toISOString();
  const url = appUrl();
  const sitemapUrl = `${url.replace(/\/$/, "")}/sitemap.xml`;
  const steps: BootstrapResult["steps"] = [];

  function record(name: string, status: "ok" | "skipped" | "error", detail?: string) {
    steps.push({ name, status, detail: detail?.slice(0, 200) });
  }

  // 1. Google Search Console: add property, submit sitemap.
  try {
    const already = await gsc.hasSite(url).catch(() => false);
    if (already) {
      record("gsc.addSite", "skipped", "already present");
    } else {
      await gsc.addSite(url);
      record("gsc.addSite", "ok");
    }
    await gsc.submitSitemap(url, sitemapUrl);
    record("gsc.submitSitemap", "ok");
  } catch (err) {
    record("gsc", "error", (err as Error).message);
  }

  // 2. Bing Webmaster: add site, verify ownership, submit sitemap.
  // Verification is required before SubmitFeed will accept sitemaps —
  // a freshly-added site without verification gets a "NotAuthorized"
  // error. For *.zilla.so subdomain merchants, verification is
  // inherited from the parent (verifySite returns true immediately).
  // For apex-domain merchants, the BingSiteAuth.xml file must be
  // reachable at /BingSiteAuth.xml.
  try {
    await bing.addSite(url);
    record("bing.addSite", "ok");
    const verified = await bing.verifySite(url);
    if (!verified) {
      record(
        "bing.verifySite",
        "error",
        "Bing could not verify ownership. Confirm public/BingSiteAuth.xml is reachable at /BingSiteAuth.xml with the correct token, or that the parent domain is verified.",
      );
    } else {
      record("bing.verifySite", "ok");
      await bing.submitSitemap(url, sitemapUrl);
      record("bing.submitSitemap", "ok");
    }
  } catch (err) {
    record("bing", "error", (err as Error).message);
  }

  // 3. IndexNow: ping every URL in the sitemap.
  try {
    const config = indexNow.readConfigFromEnv();
    if (!config) {
      record("indexnow.ping", "skipped", "NEXT_PUBLIC_INDEXNOW_KEY or NEXT_PUBLIC_APP_URL not set");
    } else {
      const urls = await indexNow.fetchSitemapUrls(config.appUrl);
      if (urls.length === 0) {
        record("indexnow.ping", "skipped", "sitemap empty");
      } else {
        const result = await indexNow.submit(config, urls);
        const lastStatus = result.chunks[result.chunks.length - 1]?.status;
        if (lastStatus === 403) {
          record(
            "indexnow.ping",
            "error",
            `Bing not yet verified. The /${config.key}.txt file must be reachable on the live deploy. Retry in 5 min.`,
          );
        } else {
          record("indexnow.ping", "ok", `${result.submitted} URLs submitted`);
        }
      }
    }
  } catch (err) {
    record("indexnow.ping", "error", (err as Error).message);
  }

  return {
    appUrl: url,
    steps,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
