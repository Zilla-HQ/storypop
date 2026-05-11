import { EventSchemas, Inngest } from "inngest";

type Events = {
  "listings/ingested": { data: { listingId: string; source: "zillow" | "redfin" | "realtor" } };
  "listings/qualified": { data: { listingId: string; serviceId?: string } };
  "preview/ready": { data: { listingId: string; previewId: string; serviceId?: string } };
  "outreach/sent": { data: { listingId: string; outreachEventId: string } };
  "outreach/replied": { data: { listingId: string; outreachEventId: string; messageId: string } };
  "orders/paid": { data: { orderId: string } };
  "orders/fulfilled": { data: { orderId: string } };
  "orders/fulfillment_failed": { data: { orderId: string; reason: string } };
  "followup/check": { data: { listingId: string; outreachEventId: string } };
  "inbound/email": {
    data: {
      from: string;
      to: string;
      subject: string | null;
      text: string | null;
      html: string | null;
      messageId: string | null;
      inReplyTo: string | null;
    };
  };
  // Self-serve: agent or homeowner drops a listing URL on our site.
  "self-serve/submitted": {
    data: {
      listingId: string;
      url: string;
      source: "zillow" | "redfin" | "realtor";
      serviceId?: string;
    };
  };
  // Homeowner submitted contractor lead form on a /l/<slug> page.
  "lead/captured": {
    data: {
      leadId: string;
      listingId: string;
      serviceId: string;
    };
  };
  // Admin-triggered manual discovery / homeowner-discovery run (from /admin).
  "discovery/manual": { data: Record<string, never> };
  "homeowner-discovery/manual": { data: Record<string, never> };
  // Manual triggers for the Meta ads loop (from /admin/campaigns).
  "meta-ads/sync": { data: Record<string, never> };
  "meta-ads/autonomy": { data: Record<string, never> };
  "meta-ads/lead-scaler": { data: Record<string, never> };
  "meta-ads/fatigue-check": { data: Record<string, never> };
  // Manual-only re-enrichment of listings missing an agent email. Don't
  // schedule this — cron-level runs would burn Hunter / Apollo quota.
  "backfill-emails/run": { data: Record<string, never> };
  // Manual trigger for the SEO bootstrap. Idempotent — safe to fire
  // on every deploy or via cron. See lib/seo/bootstrap.ts.
  "seo/bootstrap": { data: Record<string, never> };
  // Manual trigger for X mentions auto-reply poll. Cron also fires
  // every 30 min — see inngest/functions/x-mentions-poll.ts.
  "x-mentions/poll": { data: Record<string, never> };
  // Manual trigger for the hourly abandoned-cart recovery sweep. Cron at
  // :17 — see inngest/functions/abandoned-cart.ts.
  "abandoned-cart/manual": { data: Record<string, never> };
  // Manual trigger for the social poster (Pinterest etc.). Cron in the
  // function itself — see inngest/functions/social-poster.ts.
  "social-poster/manual": { data: Record<string, never> };
  // Google Ads autonomy. Sync hourly + autonomy daily — both run on
  // cron AND can be manually triggered from /admin/campaigns.
  "google-ads/sync": { data: Record<string, never> };
  "google-ads/autonomy": { data: Record<string, never> };
  "google-ads/branded-scaler": { data: Record<string, never> };
  // Sponsor / partner / press outreach (3-touch cadence).
  "sponsor/discover": { data: Record<string, never> };
  "sponsor/send": { data: Record<string, never> };
  "sponsor/follow-up": { data: Record<string, never> };
  // Hourly abandoned-checkout follow-up (one email per listing ever).
  // Distinct from `abandoned-cart/manual` above which is the existing
  // pre-Stripe-checkout cart recovery; this is the post-checkout 4-hour
  // founder-tone touch (see inngest/functions/abandoned-checkout.ts).
  "abandoned-checkout/run": { data: Record<string, never> };
  // Lob direct-mail postcard cron.
  "direct-mail/run": { data: Record<string, never> };
  // Spectacle layer crons (agent persona — diary auto-tweet + Monday
  // weekly recap tweet). Gated on SPECTACLE_ENABLED + TWITTER_ENABLED.
  "diary/publish-tweet": { data: Record<string, never> };
  "spectacle/weekly-recap-tweet": { data: Record<string, never> };
  // Monday 13:00 UTC operator digest. One email summarizing every
  // channel from the past week.
  "weekly-digest/run": { data: Record<string, never> };
  // Extended follow-up touches 3 (day 7) and 4 (day 14).
  "followup/touch-3": { data: { listingId: string; outreachEventId: string } };
  "followup/touch-4": { data: { listingId: string; outreachEventId: string } };
  // Restay-style multi-tier (tier 1 → tier 6) follow-up chain — fired by
  // outreach.ts at send time, picked up by scheduled-followups.ts at the
  // scheduled date. Distinct from followup/touch-3 + touch-4 above (which
  // are per-listing extended touches); these are batch tier sends used by
  // the warm-up ramp scripts in scripts/send-tier*-batch.ts.
  "outreach/schedule-tier1-followup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier1-breakup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier2-breakup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier3-followup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier3-breakup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier4-followup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier4-breakup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier5-followup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier5-breakup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier6-followup": { data: { listingId: string; outreachEventId: string } };
  "outreach/schedule-tier6-breakup": { data: { listingId: string; outreachEventId: string } };
};

export const inngest = new Inngest({
  id: "relist",
  schemas: new EventSchemas().fromRecord<Events>(),
});
