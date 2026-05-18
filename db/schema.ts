import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * StoryPop schema — personalized illustrated children's books.
 *
 * The merchant-template's `listings`/`previews`/`orders`/`messages`/
 * `outreach_events`/`admin_settings`/`agent_costs` shape is retained
 * (platform-level), but the `listings` table is rewritten with
 * book-domain columns (childName, archetype, photoUrl, loraId, story).
 * New tables: `prints` (Lulu jobs) and `book_pages` (per-page render
 * outputs + per-page cost tracking).
 *
 * Postgres schema name `relist` preserved for migration cleanliness;
 * rename in a follow-up once we're past template-fork stage.
 */
export const storypopSchema = pgSchema("relist");

// ============ enums ============
export const sourceEnum = storypopSchema.enum("listing_source", [
  "web_form",
  "gift_redemption",
  "admin_seed",
]);

export const orderTierEnum = storypopSchema.enum("order_tier", ["standard", "premium", "rush"]);
export const orderStatusEnum = storypopSchema.enum("order_status", [
  "pending",
  "paid",
  "fulfilling",
  "fulfilled",
  "refunded",
  "failed",
]);
export const messageDirectionEnum = storypopSchema.enum("message_direction", [
  "inbound",
  "outbound",
]);
export const outreachChannelEnum = storypopSchema.enum("outreach_channel", ["email", "sms"]);
export const outreachStatusEnum = storypopSchema.enum("outreach_status", [
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

export const archetypeEnum = storypopSchema.enum("book_archetype", [
  "bedtime",
  "adventure",
  "first-day",
  "sibling",
  "lost-tooth",
  "birthday",
]);
export const stylePresetEnum = storypopSchema.enum("style_preset", [
  "picture-book-warm",
  "picture-book-bold",
  "picture-book-pastel",
  "watercolor",
]);

// ============ listings — StoryPop's "books" (table name retained for platform contract) ============
export const listings = storypopSchema.table(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    source: sourceEnum("source").notNull().default("web_form"),

    // Book inputs
    childName: text("child_name").notNull(),
    childAge: integer("child_age").notNull(),
    pronouns: text("pronouns"), // "he/him" | "she/her" | "they/them"
    archetype: archetypeEnum("archetype").notNull().default("adventure"),
    /** Free-form parent description ("super silly, loves dinosaurs, gives the
     *  best hugs"). Replaces the legacy enum-only archetype as the primary
     *  personalization signal — Claude reads this directly. */
    description: text("description"),
    /** Free-form favorites ("Bluey, Frozen, dragons, space"). Claude maps
     *  trademarked names → safe archetypes server-side. */
    favorites: text("favorites"),
    photoUrl: text("photo_url"),
    photoExpiresAt: timestamp("photo_expires_at", { withTimezone: true }),
    stylePreset: stylePresetEnum("style_preset").notNull().default("picture-book-warm"),
    /** Fallback features when no photo uploaded. */
    defaultCharacterHints: jsonb("default_character_hints").$type<{
      skinTone?: "fair" | "medium" | "tan" | "dark";
      hairColor?: "blonde" | "brown" | "black" | "red" | "other";
      hairStyle?: "short" | "long" | "curly" | "braided";
      glasses?: boolean;
    } | null>(),

    // Buyer (parent/gifter) info
    primaryContactEmail: text("primary_contact_email"),
    primaryContactName: text("primary_contact_name"),

    // fal.ai outputs
    loraId: text("lora_id"),
    story: jsonb("story").$type<{
      title: string;
      dedication: string;
      pages: { sceneDescription: string; body: string }[];
    } | null>(),
    /** Preview pages already rendered; the rest are gated post-payment. */
    previewPages: jsonb("preview_pages")
      .$type<{ pageNumber: number; r2Key: string; flagged: boolean }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    previewPdfUrl: text("preview_pdf_url"),
    finalPdfUrl: text("final_pdf_url"),

    // Scoring + qualification
    formCompleteness: integer("form_completeness"), // 0-100
    photoClarityScore: integer("photo_clarity_score"), // 0-100
    qualified: boolean("qualified").notNull().default(false),
    qualificationReason: text("qualification_reason"),

    status: text("status").notNull().default("new"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    qualifiedIdx: index("listings_qualified_idx").on(t.qualified),
    emailIdx: index("listings_email_idx").on(t.primaryContactEmail),
    photoExpiresIdx: index("listings_photo_expires_idx").on(t.photoExpiresAt),
    createdAtIdx: index("listings_created_at_idx").on(t.createdAt),
  }),
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

// ============ previews — free-tier preview payload (pages 1-3) ============
export const previews = storypopSchema.table(
  "previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    payload: jsonb("payload")
      .$type<{
        previewPages: { pageNumber: number; r2Key: string; flagged: boolean }[];
        story: {
          title: string;
          dedication: string;
          pages: { sceneDescription: string; body: string }[];
        };
        stylePreset: string;
      }>()
      .notNull(),
    costCents: integer("cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("previews_listing_idx").on(t.listingId),
  }),
);
export type Preview = typeof previews.$inferSelect;
export type NewPreview = typeof previews.$inferInsert;

// ============ book_pages — per-page render output + per-page cost ============
export const bookPages = storypopSchema.table(
  "book_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    sceneDescription: text("scene_description"),
    bodyText: text("body_text"),
    imageR2Key: text("image_r2_key"),
    generationCostCents: integer("generation_cost_cents").notNull().default(0),
    retries: integer("retries").notNull().default(0),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    bookPageUniq: unique("book_pages_book_page_uniq").on(t.bookId, t.pageNumber),
    bookIdx: index("book_pages_book_idx").on(t.bookId),
  }),
);
export type BookPage = typeof bookPages.$inferSelect;
export type NewBookPage = typeof bookPages.$inferInsert;

// ============ outreach_events (transactional + abandoned-cart only) ============
export const outreachEvents = storypopSchema.table(
  "outreach_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    channel: outreachChannelEnum("channel").notNull().default("email"),
    templateId: text("template_id"),
    kind: text("kind"), // 'preview-ready' | 'delivery' | 'abandoned-cart' | 'refund'
    senderDomain: text("sender_domain"),
    subject: text("subject"),
    body: text("body"),
    resendId: text("resend_id"),
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
  }),
);
export type OutreachEvent = typeof outreachEvents.$inferSelect;
export type NewOutreachEvent = typeof outreachEvents.$inferInsert;

// ============ orders — single-purchase + gift-bundle ============
export const orders = storypopSchema.table(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),

    /** SKU id: pdf | softcover | hardcover | gift-bundle. */
    serviceId: text("service_id").notNull().default("hardcover"),
    tier: orderTierEnum("tier").notNull().default("standard"),
    rush: boolean("rush").notNull().default(false),
    amountCents: integer("amount_cents").notNull(),

    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    status: orderStatusEnum("status").notNull().default("pending"),

    customerEmail: text("customer_email"),
    /** Lulu/Printful shipping snapshot at time of order. */
    shipping: jsonb("shipping").$type<{
      name: string;
      street1: string;
      street2?: string;
      city: string;
      stateCode: string;
      postcode: string;
      countryCode: string;
      phone?: string;
    } | null>(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (t) => ({
    listingIdx: index("orders_listing_idx").on(t.listingId),
    statusIdx: index("orders_status_idx").on(t.status),
    sessionUniq: unique("orders_stripe_session_uniq").on(t.stripeSessionId),
  }),
);
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// ============ prints — Lulu print-job tracking ============
export const prints = storypopSchema.table(
  "prints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(), // softcover | hardcover | gift-bundle
    luluJobId: text("lulu_job_id"),
    /** CREATED | UNPAID | PAYMENT_IN_PROGRESS | PRODUCTION_DELAYED |
     *  PRODUCTION_READY | IN_PRODUCTION | SHIPPED | REJECTED | CANCELED */
    luluStatus: text("lulu_status").notNull().default("CREATED"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    estimatedShipDate: timestamp("estimated_ship_date", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdx: index("prints_order_idx").on(t.orderId),
    statusIdx: index("prints_lulu_status_idx").on(t.luluStatus),
    luluJobUniq: unique("prints_lulu_job_uniq").on(t.luluJobId),
  }),
);
export type Print = typeof prints.$inferSelect;
export type NewPrint = typeof prints.$inferInsert;

// ============ messages — inbound replies (refunds, edit requests) ============
export const messages = storypopSchema.table(
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
    classification: text("classification"), // refund_request | edit_request | gift_inquiry | etc.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index("messages_listing_idx").on(t.listingId),
    orderIdx: index("messages_order_idx").on(t.orderId),
  }),
);
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ============ admin_settings ============
export const adminSettings = storypopSchema.table("admin_settings", {
  id: integer("id").primaryKey().default(1),
  pricingPdfCents: integer("pricing_pdf_cents").notNull().default(1499),
  pricingSoftcoverCents: integer("pricing_softcover_cents").notNull().default(2999),
  pricingHardcoverCents: integer("pricing_hardcover_cents").notNull().default(4499),
  pricingBundleCents: integer("pricing_bundle_cents").notNull().default(6999),

  previewDailyCap: integer("preview_daily_cap").notNull().default(500),
  previewDailyBudgetCents: integer("preview_daily_budget_cents").notNull().default(10000),
  fulfillmentDailyBudgetCents: integer("fulfillment_daily_budget_cents").notNull().default(50000),

  paused: boolean("paused").notNull().default(false),
  previewPaused: boolean("preview_paused").notNull().default(false),
  fulfillmentPaused: boolean("fulfillment_paused").notNull().default(false),

  /** Days to retain uploaded child photos before auto-purge. */
  photoRetentionDays: integer("photo_retention_days").notNull().default(30),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type AdminSettings = typeof adminSettings.$inferSelect;
export type NewAdminSettings = typeof adminSettings.$inferInsert;

// ============ agent_costs ============
export const agentCosts = storypopSchema.table(
  "agent_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("date").notNull(),
    agent: text("agent").notNull(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    costCents: integer("cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dayAgentIdx: index("agent_costs_day_agent_idx").on(t.date, t.agent),
  }),
);
export type AgentCost = typeof agentCosts.$inferSelect;
export type NewAgentCost = typeof agentCosts.$inferInsert;

// ============ conversions — funnel events from Meta pixel + server-side ============
export const conversions = storypopSchema.table(
  "conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    eventIdx: index("conversions_event_idx").on(t.event),
    createdAtIdx: index("conversions_created_at_idx").on(t.createdAt),
  }),
);
export type Conversion = typeof conversions.$inferSelect;
export type NewConversion = typeof conversions.$inferInsert;
