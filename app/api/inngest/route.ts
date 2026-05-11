import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

import { discoveryFn } from "@/inngest/functions/discovery";
import { qualificationFn } from "@/inngest/functions/qualification";
import { previewFn } from "@/inngest/functions/preview";
import { outreachFn, outreachScheduleFollowupFn } from "@/inngest/functions/outreach";
import { fulfillmentFn } from "@/inngest/functions/fulfillment";
import { followupFn } from "@/inngest/functions/followup";
import { replyHandlerFn } from "@/inngest/functions/reply-handler";
import { selfServeIngestFn } from "@/inngest/functions/self-serve-ingest";
import { mailerFn } from "@/inngest/functions/mailer";
import { matchContractorsFn } from "@/inngest/functions/match-contractors";
import { homeownerDiscoveryFn } from "@/inngest/functions/homeowner-discovery";
import { metaAdsSyncFn } from "@/inngest/functions/meta-ads-sync";
import { metaAdsAutonomyFn } from "@/inngest/functions/meta-ads-autonomy";
import { metaAdsLeadScalerFn } from "@/inngest/functions/meta-ads-lead-scaler";
import { metaAdsFatigueCheckFn } from "@/inngest/functions/meta-ads-fatigue-check";
import { backfillEmailsFn } from "@/inngest/functions/backfill-emails";
import { seoBootstrapFn } from "@/inngest/functions/seo-bootstrap";
import { orderStuckWatchdogFn } from "@/inngest/functions/order-stuck-watchdog";
import { previewStuckWatchdogFn } from "@/inngest/functions/preview-stuck-watchdog";
import { pendingOrderWatchdogFn } from "@/inngest/functions/pending-order-watchdog";
import { dailyRevenueSummaryFn } from "@/inngest/functions/daily-revenue-summary";
import { sampleEmailFn } from "@/inngest/functions/sample-email";
import {
  scheduleTier1FollowupFn,
  scheduleTier1BreakupFn,
  scheduleTier2BreakupFn,
  scheduleTier3FollowupFn,
  scheduleTier3BreakupFn,
  scheduleTier4FollowupFn,
  scheduleTier4BreakupFn,
  scheduleTier5FollowupFn,
  scheduleTier5BreakupFn,
  scheduleTier6FollowupFn,
  scheduleTier6BreakupFn,
} from "@/inngest/functions/scheduled-followups";
import { xMentionsPollFn } from "@/inngest/functions/x-mentions-poll";
// SiteGrid-derived autonomy + spectacle + sponsor + direct-mail crons.
// Each function is self-gated on its own env vars / settings flags, so
// adding them to the registry is safe even when the merchant hasn't
// configured the underlying provider.
import { googleAdsSyncFn } from "@/inngest/functions/google-ads-sync";
import { googleAdsAutonomyFn } from "@/inngest/functions/google-ads-autonomy";
import { abandonedCheckoutFn } from "@/inngest/functions/abandoned-checkout";
import { directMailFn } from "@/inngest/functions/direct-mail";
import { sponsorDiscoverFn } from "@/inngest/functions/sponsor-discover";
import { sponsorSendFn } from "@/inngest/functions/sponsor-send";
import { sponsorFollowUpFn } from "@/inngest/functions/sponsor-follow-up";
import { weeklyDigestFn } from "@/inngest/functions/weekly-digest";
import { diaryPublishTweetFn } from "@/inngest/functions/diary-publish-tweet";
import { spectacleWeeklyRecapTweetFn } from "@/inngest/functions/spectacle-weekly-recap-tweet";
import { followupExtendedFn } from "@/inngest/functions/followup-extended";

export const runtime = "nodejs";
// Apify single-URL scrapes take ~60s, fal.ai previews ~30s/image, fulfillment
// QC loops can stretch further. Vercel Pro caps Node functions at 300s.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    discoveryFn,
    qualificationFn,
    previewFn,
    outreachFn,
    outreachScheduleFollowupFn,
    fulfillmentFn,
    followupFn,
    replyHandlerFn,
    selfServeIngestFn,
    mailerFn,
    matchContractorsFn,
    homeownerDiscoveryFn,
    metaAdsSyncFn,
    metaAdsAutonomyFn,
    metaAdsLeadScalerFn,
    metaAdsFatigueCheckFn,
    backfillEmailsFn,
    seoBootstrapFn,
    orderStuckWatchdogFn,
    previewStuckWatchdogFn,
    pendingOrderWatchdogFn,
    dailyRevenueSummaryFn,
    sampleEmailFn,
    scheduleTier1FollowupFn,
    scheduleTier1BreakupFn,
    scheduleTier2BreakupFn,
    scheduleTier3FollowupFn,
    scheduleTier3BreakupFn,
    scheduleTier4FollowupFn,
    scheduleTier4BreakupFn,
    scheduleTier5FollowupFn,
    scheduleTier5BreakupFn,
    scheduleTier6FollowupFn,
    scheduleTier6BreakupFn,
    xMentionsPollFn,
    googleAdsSyncFn,
    googleAdsAutonomyFn,
    abandonedCheckoutFn,
    directMailFn,
    sponsorDiscoverFn,
    sponsorSendFn,
    sponsorFollowUpFn,
    weeklyDigestFn,
    diaryPublishTweetFn,
    spectacleWeeklyRecapTweetFn,
    followupExtendedFn,
  ],
});
