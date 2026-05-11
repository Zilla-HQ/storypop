import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
// MetaInsightsMetadata import dropped — Meta insights table not used in StoryPop v1.
type MetaInsightsMetadata = Record<string, unknown>;

// All Relist tables live under the "relist" schema so they can share a
// Supabase/Postgres instance with other apps without colliding on common
// names like "messages" or "orders".
export const relistSchema = pgSchema("relist");

// ============ Enums ============

export const sourceEnum = relistSchema.enum("listing_source", [
  "zillow",
  "redfin",
  "realtor",
  // Homeowner-side sources. The first is set when a homeowner submits an
  // address through /renovate. The other two are cold-scrape sources that
  // pull owner-of-record property records (county tax + skiptracing) for
  // proactive homeowner outreach.
  "homeowner_self_serve",
  "attom",
  "propertyradar",
]);
export const listingTypeEnum = relistSchema.enum("listing_type", [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "land",
  "other",
]);
export const outreachChannelEnum = relistSchema.enum("outreach_channel", ["email", "sms"]);
export const outreachStatusEnum = relistSchema.enum("outreach_status", [
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "replied",
  "unsubscribed",
  "failed",
]);
export const orderTierEnum = relistSchema.enum("order_tier", ["standard", "premium", "rush"]);
export const orderStatusEnum = relistSchema.enum("order_status", [
  "pending",
  "paid",
  "fulfilling",
  "fulfilled",
  "refunded",
  "failed",
]);
export const messageDirectionEnum = relistSchema.enum("message_direction", ["inbound", "outbound"]);

// ============ listings ============

export const listings = relistSchema.table(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    mlsId: text("mls_id"),

    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    price: integer("price").notNull(), // cents
    dom: integer("dom"),
    listingType: listingTypeEnum("listing_type").default("single_family"),

    photos: jsonb("photos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    agentName: text("agent_name"),
    agentEmail: text("agent_email"),
    agentPhone: text("agent_phone"),
    brokerage: text("brokerage"),

    photoScore: doublePrecision("photo_score"),
    agentValueScore: doublePrecision("agent_value_score"),
    targetScore: doublePrecision("target_score"),

    qualified: boolean("qualified").default(false).notNull(),
    qualificationReason: text("qualification_reason"),

    // Floor plan analysis output, when a floor plan was detected in the photos.
    floorplanRecommendations: jsonb("floorplan_recommendations").$type<{
      bedroomCount: number;
      bathroomCount: number;
      recommendations: Array<{
        title: string;
        rationale: string;
        complexity: "easy" | "medium" | "hard";
        estCostLowCents: number;
        estCostHighCents: number;
        estValueLiftLowCents: number;
        estValueLiftHighCents: number;
        permitRequired: boolean;
      }>;
    }>(),
    floorplanSourceUrl: text("floorplan_source_url"),

    slug: text("slug").notNull(),

    // Engagement state used by /api/track/{open,click}, the reply handler,
    // and the abandoned-cart cron to decide what to send next. New rows start
    // at "new"; the tracking pixel/redirector promotes them to "opened" →
    // "clicked"; reply-handler promotes to "replied"; Stripe webhook
    // promotes to "purchased". Never downgrade — old emails firing a fresh
    // pixel must not undo a later state. See /api/track/click for the
    // CASE-ladder guard.
    status: text("status").notNull().default("new"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceUniq: unique("listings_source_source_id_uniq").on(t.source, t.sourceId),
    slugUniq: unique("listings_slug_uniq").on(t.slug),
    qualifiedIdx: index("listings_qualified_idx").on(t.qualified),
    agentEmailIdx: index("listings_agent_email_idx").on(t.agentEmail),
    createdAtIdx: index("listings_created_at_idx").on(t.createdAt),
    statusIdx: index("listings_status_idx").on(t.status),
  }),
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

// ============ previews ============

export const previews = relistSchema.table(
  "previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),

    // Which Merchant service generated this preview (slug from lib/services.ts).
    // Defaults to "photo-staging" so existing rows don't break on read.
    serviceId: text("service_id").notNull().default("photo-staging"),

    originalPhotoUrls: jsonb("original_photo_urls").$type<string[]>().notNull(),
    enhancedPhotoUrls: jsonb("enhanced_photo_urls").$type<string[]>().notNull(),

    stylePreset: text("style_preset").notNull(),
    costCents: integer("cost_cents").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("previews_listing_idx").on(t.listingId),
    serviceIdx: index("previews_service_idx").on(t.serviceId),
  }),
);

export type Preview = typeof previews.$inferSelect;
export type NewPreview = typeof previews.$inferInsert;

// ============ outreach_events ============

export const outreachEvents = relistSchema.table(
  "outreach_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),

    channel: outreachChannelEnum("channel").notNull(),
    templateId: text("template_id").notNull(),
    senderDomain: text("sender_domain"),

    subject: text("subject"),
    body: text("body"),

    resendId: text("resend_id"),
    twilioSid: text("twilio_sid"),

    status: outreachStatusEnum("status").notNull().default("queued"),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    firstClickedAt: timestamp("first_clicked_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("outreach_listing_idx").on(t.listingId),
    resendIdx: index("outreach_resend_idx").on(t.resendId),
    statusIdx: index("outreach_status_idx").on(t.status),
    sentAtIdx: index("outreach_sent_at_idx").on(t.sentAt),
  }),
);

export type OutreachEvent = typeof outreachEvents.$inferSelect;
export type NewOutreachEvent = typeof outreachEvents.$inferInsert;

// ============ orders ============

export const orders = relistSchema.table(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),

    tier: orderTierEnum("tier").notNull().default("standard"),
    stylePreset: text("style_preset").notNull().default("modern"),
    amountCents: integer("amount_cents").notNull(),

    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    status: orderStatusEnum("status").notNull().default("pending"),

    fulfillmentJobId: text("fulfillment_job_id"),
    deliveryUrl: text("delivery_url"),
    zipUrl: text("zip_url"),

    customerEmail: text("customer_email"),

    // Affiliate / referral attribution. Set from `?ref=<code>` on the
    // checkout link, persisted with the Stripe session so payouts can be
    // computed in /admin/referrals. See lib/referral.ts for code minting.
    referralCode: text("referral_code"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (t) => ({
    listingIdx: index("orders_listing_idx").on(t.listingId),
    statusIdx: index("orders_status_idx").on(t.status),
    sessionUniq: unique("orders_stripe_session_uniq").on(t.stripeSessionId),
    referralCodeIdx: index("orders_referral_code_idx").on(t.referralCode),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// ============ messages ============

export const messages = relistSchema.table(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),

    direction: messageDirectionEnum("direction").notNull(),
    from: text("from").notNull(),
    to: text("to").notNull(),
    subject: text("subject"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    messageIdHeader: text("message_id_header"),
    inReplyTo: text("in_reply_to"),

    aiReplyGenerated: boolean("ai_reply_generated").default(false).notNull(),
    humanFlag: boolean("human_flag").default(false).notNull(),
    classification: text("classification"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("messages_listing_idx").on(t.listingId),
    orderIdx: index("messages_order_idx").on(t.orderId),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ============ admin_settings (single-row config) ============

export type StylePreset = {
  id: string;
  label: string;
  description: string;
  promptFragment: string;
};

export const adminSettings = relistSchema.table("admin_settings", {
  id: integer("id").primaryKey().default(1),

  pricingStandardCents: integer("pricing_standard_cents").notNull().default(7900),
  pricingPremiumCents: integer("pricing_premium_cents").notNull().default(14900),
  pricingRushCents: integer("pricing_rush_cents").notNull().default(19900),

  dailySendCap: integer("daily_send_cap").notNull().default(500),
  previewDailyCap: integer("preview_daily_cap").notNull().default(500),
  fulfillmentDailyBudgetCents: integer("fulfillment_daily_budget_cents")
    .notNull()
    .default(100000),

  paused: boolean("paused").notNull().default(false),
  discoveryPaused: boolean("discovery_paused").notNull().default(false),
  qualificationPaused: boolean("qualification_paused").notNull().default(false),
  previewPaused: boolean("preview_paused").notNull().default(false),
  outreachPaused: boolean("outreach_paused").notNull().default(false),
  fulfillmentPaused: boolean("fulfillment_paused").notNull().default(false),
  followupPaused: boolean("followup_paused").notNull().default(false),
  // Postcard mailer is OFF by default — flip via admin settings to enable.
  mailerEnabled: boolean("mailer_enabled").notNull().default(false),

  stylePresets: jsonb("style_presets")
    .$type<StylePreset[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  senderDomains: jsonb("sender_domains")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  brokerageBlacklist: jsonb("brokerage_blacklist")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  emailBlacklist: jsonb("email_blacklist")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  // X (Twitter) auth — see X.md. xRefreshToken is a long-lived OAuth 2.0
  // refresh token issued to the merchant's brand account once via
  // /api/auth/x/start; lib/x-poster.ts swaps it for a short-lived access
  // token on every send. xUserId + xUsername are cached after the first
  // /2/users/me call so we can fetch mentions without re-hitting it.
  // xMentionsSinceId is the watermark for the hourly auto-reply cron.
  xRefreshToken: text("x_refresh_token"),
  xUserId: text("x_user_id"),
  xUsername: text("x_username"),
  xMentionsSinceId: text("x_mentions_since_id"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============ x_mentions (audit log of every @mention + reply decision) ============

export const xMentions = relistSchema.table(
  "x_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mentionTweetId: text("mention_tweet_id").notNull().unique(),
    authorId: text("author_id").notNull(),
    authorUsername: text("author_username"),
    text: text("text").notNull(),
    createdAtX: timestamp("created_at_x", { withTimezone: true }),
    decision: text("decision").notNull(), // "replied" | "skipped" | "errored"
    reasoning: text("reasoning").notNull(),
    replyTweetId: text("reply_tweet_id"),
    replyText: text("reply_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    decisionIdx: index("x_mentions_decision_idx").on(t.decision),
    createdAtIdx: index("x_mentions_created_at_idx").on(t.createdAt),
  }),
);

export type XMention = typeof xMentions.$inferSelect;
export type NewXMention = typeof xMentions.$inferInsert;

export type AdminSettings = typeof adminSettings.$inferSelect;

// ============ agent_costs (daily cost tracking) ============

export const agentCosts = relistSchema.table(
  "agent_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("date").notNull(), // YYYY-MM-DD UTC
    agent: text("agent").notNull(), // discovery|qualification|preview|outreach|fulfillment|followup
    costCents: integer("cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dayAgentIdx: index("agent_costs_day_agent_idx").on(t.date, t.agent),
  }),
);

export type AgentCost = typeof agentCosts.$inferSelect;
export type NewAgentCost = typeof agentCosts.$inferInsert;

// ============ contractor_leads (homeowner → contractor referral) ============

export const contractorLeads = relistSchema.table(
  "contractor_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    serviceId: text("service_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    budgetBand: text("budget_band"), // "<25k" | "25-50k" | "50-100k" | "100k+"
    timeline: text("timeline"), // "asap" | "3-months" | "6-months" | "exploring"
    notes: text("notes"),
    // new | contacted | matched | converted | lost
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("contractor_leads_listing_idx").on(t.listingId),
    statusIdx: index("contractor_leads_status_idx").on(t.status),
  }),
);

export type ContractorLead = typeof contractorLeads.$inferSelect;
export type NewContractorLead = typeof contractorLeads.$inferInsert;

// ============ contractor_intros (Yelp-matched contractors per lead) ============

export const contractorIntros = relistSchema.table(
  "contractor_intros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => contractorLeads.id, { onDelete: "cascade" }),
    contractorName: text("contractor_name").notNull(),
    contractorPhone: text("contractor_phone"),
    contractorUrl: text("contractor_url"),
    contractorAddress: text("contractor_address"),
    contractorEmail: text("contractor_email"),
    contractorWebsite: text("contractor_website"),
    /** "yelp_page" | "google_search" — how we discovered the email. Null = no email found. */
    emailSource: text("email_source"),
    rating: doublePrecision("rating"),
    reviewCount: integer("review_count"),
    yelpId: text("yelp_id"),
    rank: integer("rank").notNull().default(0),
    // queued | introduced | accepted | declined | converted | lost | manual
    status: text("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    leadIdx: index("contractor_intros_lead_idx").on(t.leadId),
    statusIdx: index("contractor_intros_status_idx").on(t.status),
  }),
);

export type ContractorIntro = typeof contractorIntros.$inferSelect;
export type NewContractorIntro = typeof contractorIntros.$inferInsert;

// ============ campaigns (Meta ad campaigns + insights snapshots) ============

export const campaigns = relistSchema.table(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // External identifiers from the ad platform. Currently only "meta" is wired
    // up but the column is open so other platforms can land alongside it.
    platform: text("platform").notNull().default("meta"),
    metaCampaignId: text("meta_campaign_id"),

    name: text("name").notNull(),
    // active | paused | archived | deleted (lowercased Meta status)
    status: text("status").notNull().default("paused"),

    // All money fields are stored in cents (consistent with orders/listings).
    budgetCents: integer("budget_cents").notNull().default(0),
    spentCents: integer("spent_cents").notNull().default(0),

    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversionsCount: integer("conversions_count").notNull().default(0),

    // Full insights blob from getCampaignInsights — reach, frequency, quality
    // rankings, full action breakdown. The autonomy job reads spend +
    // conversions; this column lets the admin UI render anything else without
    // schema churn.
    metadata: jsonb("metadata").$type<MetaInsightsMetadata>(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    metaCampaignIdUniq: unique("campaigns_meta_campaign_id_uniq").on(t.metaCampaignId),
    platformIdx: index("campaigns_platform_idx").on(t.platform),
    statusIdx: index("campaigns_status_idx").on(t.status),
  }),
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

// =====================================================================
// SiteGrid-derived tables — ported from Zilla-HQ/sitegrid in 2026-05.
//
// These are reusable patterns proven on a live $199-DFY-websites merchant:
// affiliate program, sponsor/partner/press outreach, direct mail, the
// "spectacle" public-counter persona, and an explicit email blocklist.
//
// Future merchants can keep, prune, or rename. The README's §"Optional
// capabilities" table tells you which features each set of tables powers.
// =====================================================================

// ---------- email_blocklist ----------
// Permanent opt-out list. Any address present here must never be cold-
// emailed again, regardless of how the outreach loop discovered it.
// Populated by:
//   - Resend complaint webhooks → "complained" reason
//   - Inbound unsubscribe replies (mailto: List-Unsubscribe + Claude
//     classifier "unsubscribe" bucket) → "unsubscribed" reason
//   - Manual operator additions → "manual" reason
export const emailBlocklist = relistSchema.table("email_blocklist", {
  email: text("email").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export type EmailBlocklist = typeof emailBlocklist.$inferSelect;
export type NewEmailBlocklist = typeof emailBlocklist.$inferInsert;

// ---------- conversions ----------
// Funnel event stream for the dashboard + weekly digest. Distinct from
// outreach_events (which is delivery-side) — conversions captures the
// downstream user actions: page view, click, checkout started, purchased.
// Indexed on (event, createdAt) because every digest read filters by both.
export const conversions = relistSchema.table(
  "conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    // Optional per-merchant grouping fields. Vertical-specific merchants
    // can leave these null; multi-vertical merchants populate them so the
    // funnel dashboard can group by vertical/city.
    vertical: text("vertical"),
    city: text("city"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    eventIdx: index("conversions_event_idx").on(t.event),
    createdAtIdx: index("conversions_created_at_idx").on(t.createdAt),
    listingIdx: index("conversions_listing_idx").on(t.listingId),
  }),
);
export type Conversion = typeof conversions.$inferSelect;
export type NewConversion = typeof conversions.$inferInsert;

// ---------- referrals ----------
// Affiliate / referral program. Operator gives a partner a code (e.g.
// "JOE") and any visit to /ref/JOE drops a 90-day cookie that flows
// through checkout into Stripe metadata. Two rows per cycle:
//   1. status='clicked' at /ref/:code visit time
//   2. status='purchased' at Stripe webhook checkout.session.completed
// Tiered commissions live in lib/affiliate-tiers.ts; payout is monthly.
export const referrals = relistSchema.table(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    status: text("status").notNull(), // clicked, purchased
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents"), // populated on purchase
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: index("referrals_code_idx").on(t.code),
    statusIdx: index("referrals_status_idx").on(t.status),
    createdAtIdx: index("referrals_created_at_idx").on(t.createdAt),
  }),
);
export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;

// ---------- outbound_contacts ----------
// Sponsors, podcast hosts, newsletter editors, partners, press contacts.
// Distinct lifecycle from `listings` — pitching them on a sponsorship or
// partnership, not selling them the product. Inbound replies are routed
// by from-email-match against this table BEFORE falling through to the
// listing-email match (sponsors should never trigger the cold-outreach
// auto-classifier).
//
// autoSendEnabled is the per-contact opt-in: even when the sponsor cron
// is on, only flagged contacts auto-send.
export const outboundContacts = relistSchema.table(
  "outbound_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull().default("other"), // podcast, newsletter, partner, press, other
    name: text("name"),
    email: text("email").notNull().unique(),
    organization: text("organization"),
    role: text("role"),
    // queued, sent, replied, declined, won, archived
    status: text("status").notNull().default("queued"),
    notes: text("notes"),
    templateId: text("template_id"),
    touchNumber: integer("touch_number").notNull().default(0),
    lastSendAt: timestamp("last_send_at", { withTimezone: true }),
    lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
    autoSendEnabled: boolean("auto_send_enabled").notNull().default(false),
    source: text("source"), // 'seed_discover', 'manual', 'import'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("outbound_contacts_status_idx").on(t.status),
    kindIdx: index("outbound_contacts_kind_idx").on(t.kind),
  }),
);
export type OutboundContact = typeof outboundContacts.$inferSelect;
export type NewOutboundContact = typeof outboundContacts.$inferInsert;

// ---------- outbound_contact_messages ----------
// One row per outbound send AND per inbound reply, threaded by contactId.
// `direction` distinguishes them so the admin thread view renders a single
// conversation. Reply bodies are stored here (not in `messages`, which is
// for listing-owner replies in the cold-outreach loop).
export const outboundContactMessages = relistSchema.table(
  "outbound_contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => outboundContacts.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(), // 'out' | 'in'
    subject: text("subject"),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().default("sent"), // sent, bounced, received, failed
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contactIdx: index("outbound_contact_messages_contact_idx").on(t.contactId),
    createdAtIdx: index("outbound_contact_messages_created_at_idx").on(t.createdAt),
  }),
);
export type OutboundContactMessage = typeof outboundContactMessages.$inferSelect;
export type NewOutboundContactMessage = typeof outboundContactMessages.$inferInsert;

// ---------- direct_mail_events ----------
// Lob postcard send log. One row per send so we can resync the per-piece
// cost (Lob bills cents per piece) and prevent re-mailing the same
// listing. The status field tracks Lob's lifecycle (created → in_transit
// → delivered) when webhooks are wired up.
export const directMailEvents = relistSchema.table(
  "direct_mail_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("lob"),
    providerId: text("provider_id"),
    status: text("status").notNull().default("created"), // created, sent, delivered, failed
    costCents: integer("cost_cents"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("direct_mail_events_listing_idx").on(t.listingId),
    statusIdx: index("direct_mail_events_status_idx").on(t.status),
    createdAtIdx: index("direct_mail_events_created_at_idx").on(t.createdAt),
  }),
);
export type DirectMailEvent = typeof directMailEvents.$inferSelect;
export type NewDirectMailEvent = typeof directMailEvents.$inferInsert;

// =====================================================================
// Spectacle layer (the public-facing agent persona — Earl in SiteGrid).
// Three surfaces: /live (counters), /diary (markdown journal), /bench
// (model leaderboard). Optional per merchant — most merchants won't run
// a public persona, but the pattern is reusable when you do.
// =====================================================================

// ---------- agent_thoughts ----------
// Every reasoning step the build pipeline emits gets logged here. Default
// isPublic=false so nothing surfaces on /live until the operator flips
// it via /admin/thoughts. Auto-flagged thoughts (heuristic match on
// trigger words) appear at the top of the curation queue with
// flaggedForReview=true.
export const agentThoughts = relistSchema.table(
  "agent_thoughts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    flaggedForReview: boolean("flagged_for_review").notNull().default(false),
    source: text("source"), // 'build_step', 'manual', 'cron'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => ({
    publicIdx: index("agent_thoughts_public_idx").on(t.isPublic),
    flaggedIdx: index("agent_thoughts_flagged_idx").on(t.flaggedForReview),
    createdAtIdx: index("agent_thoughts_created_at_idx").on(t.createdAt),
  }),
);
export type AgentThought = typeof agentThoughts.$inferSelect;
export type NewAgentThought = typeof agentThoughts.$inferInsert;

// ---------- bench_runs ----------
// Public leaderboard rows for /bench. Operators benchmark frontier models
// (Claude, GPT, Gemini, …) running the merchant for one week each and
// publish results. Schema future-proofed for per-vertical / per-region
// breakouts — current MVP is headline numbers only.
export const benchRuns = relistSchema.table(
  "bench_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelName: text("model_name").notNull(),
    modelOrg: text("model_org"),
    runStartedAt: timestamp("run_started_at", { withTimezone: true }).notNull(),
    runEndedAt: timestamp("run_ended_at", { withTimezone: true }),
    unitsBuilt: integer("units_built").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0),
    csat: text("csat"), // averaged 1-5 customer satisfaction
    failureRate: text("failure_rate"), // pct as string e.g. "0.04"
    status: text("status").notNull().default("queued"), // queued, running, completed, failed
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("bench_runs_status_idx").on(t.status),
  }),
);
export type BenchRun = typeof benchRuns.$inferSelect;
export type NewBenchRun = typeof benchRuns.$inferInsert;

// ---------- outbound_tweets ----------
// Log of every tweet the harness intends to post OR did post. Distinct
// from x_mentions (which logs INBOUND mentions + reply decisions); this
// is OUTBOUND. When TWITTER_ENABLED=false, rows still get inserted with
// status='dry_run' so the operator can review intent before flipping
// the switch.
//
// Three patterns the spectacle cron uses:
//   - build_completion: tweeted when a unit ships (gated on per-listing
//     showPublicly opt-in flag — see listings.showPublicly extension)
//   - diary: auto-tweeted when a new diary entry is published
//   - weekly_recap: weekly metrics tweet from the spectacle Monday cron
export const outboundTweets = relistSchema.table(
  "outbound_tweets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // 'build_completion', 'diary', 'weekly_recap'
    body: text("body").notNull(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    diarySlug: text("diary_slug"),
    status: text("status").notNull().default("queued"), // queued, dry_run, sent, skipped, failed
    twitterId: text("twitter_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    diarySlugIdx: index("outbound_tweets_diary_slug_idx").on(t.diarySlug),
    statusIdx: index("outbound_tweets_status_idx").on(t.status),
  }),
);
export type OutboundTweet = typeof outboundTweets.$inferSelect;
export type NewOutboundTweet = typeof outboundTweets.$inferInsert;
