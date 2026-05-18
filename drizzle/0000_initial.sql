CREATE SCHEMA "storypop";
--> statement-breakpoint
CREATE TYPE "storypop"."book_archetype" AS ENUM('bedtime', 'adventure', 'first-day', 'sibling', 'lost-tooth', 'birthday');--> statement-breakpoint
CREATE TYPE "storypop"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "storypop"."order_status" AS ENUM('pending', 'paid', 'fulfilling', 'fulfilled', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "storypop"."order_tier" AS ENUM('standard', 'premium', 'rush');--> statement-breakpoint
CREATE TYPE "storypop"."outreach_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "storypop"."outreach_status" AS ENUM('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'replied', 'unsubscribed', 'failed');--> statement-breakpoint
CREATE TYPE "storypop"."listing_source" AS ENUM('web_form', 'gift_redemption', 'admin_seed');--> statement-breakpoint
CREATE TYPE "storypop"."style_preset" AS ENUM('picture-book-warm', 'picture-book-bold', 'picture-book-pastel', 'watercolor');--> statement-breakpoint
CREATE TABLE "storypop"."admin_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pricing_pdf_cents" integer DEFAULT 1499 NOT NULL,
	"pricing_softcover_cents" integer DEFAULT 2999 NOT NULL,
	"pricing_hardcover_cents" integer DEFAULT 4499 NOT NULL,
	"pricing_bundle_cents" integer DEFAULT 6999 NOT NULL,
	"preview_daily_cap" integer DEFAULT 500 NOT NULL,
	"preview_daily_budget_cents" integer DEFAULT 10000 NOT NULL,
	"fulfillment_daily_budget_cents" integer DEFAULT 50000 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"preview_paused" boolean DEFAULT false NOT NULL,
	"fulfillment_paused" boolean DEFAULT false NOT NULL,
	"photo_retention_days" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."agent_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"agent" text NOT NULL,
	"listing_id" uuid,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."book_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"scene_description" text,
	"body_text" text,
	"image_r2_key" text,
	"generation_cost_cents" integer DEFAULT 0 NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_pages_book_page_uniq" UNIQUE("book_id","page_number")
);
--> statement-breakpoint
CREATE TABLE "storypop"."conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"event" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "storypop"."listing_source" DEFAULT 'web_form' NOT NULL,
	"child_name" text NOT NULL,
	"child_age" integer NOT NULL,
	"pronouns" text,
	"archetype" "storypop"."book_archetype" DEFAULT 'adventure' NOT NULL,
	"description" text,
	"favorites" text,
	"photo_url" text,
	"photo_expires_at" timestamp with time zone,
	"style_preset" "storypop"."style_preset" DEFAULT 'picture-book-warm' NOT NULL,
	"default_character_hints" jsonb,
	"primary_contact_email" text,
	"primary_contact_name" text,
	"lora_id" text,
	"story" jsonb,
	"preview_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_pdf_url" text,
	"final_pdf_url" text,
	"form_completeness" integer,
	"photo_clarity_score" integer,
	"qualified" boolean DEFAULT false NOT NULL,
	"qualification_reason" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"listing_id" uuid NOT NULL,
	"direction" "storypop"."message_direction" NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"message_id_header" text,
	"in_reply_to" text,
	"classification" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"service_id" text DEFAULT 'hardcover' NOT NULL,
	"tier" "storypop"."order_tier" DEFAULT 'standard' NOT NULL,
	"rush" boolean DEFAULT false NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"status" "storypop"."order_status" DEFAULT 'pending' NOT NULL,
	"customer_email" text,
	"shipping" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	CONSTRAINT "orders_stripe_session_uniq" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "storypop"."outreach_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"channel" "storypop"."outreach_channel" DEFAULT 'email' NOT NULL,
	"template_id" text,
	"kind" text,
	"sender_domain" text,
	"subject" text,
	"body" text,
	"resend_id" text,
	"status" "storypop"."outreach_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"first_opened_at" timestamp with time zone,
	"first_clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storypop"."prints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"lulu_job_id" text,
	"lulu_status" text DEFAULT 'CREATED' NOT NULL,
	"tracking_number" text,
	"tracking_url" text,
	"estimated_ship_date" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prints_lulu_job_uniq" UNIQUE("lulu_job_id")
);
--> statement-breakpoint
ALTER TABLE "storypop"."agent_costs" ADD CONSTRAINT "agent_costs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "storypop"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."book_pages" ADD CONSTRAINT "book_pages_book_id_listings_id_fk" FOREIGN KEY ("book_id") REFERENCES "storypop"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."conversions" ADD CONSTRAINT "conversions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "storypop"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "storypop"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."messages" ADD CONSTRAINT "messages_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "storypop"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "storypop"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."outreach_events" ADD CONSTRAINT "outreach_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "storypop"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."previews" ADD CONSTRAINT "previews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "storypop"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."prints" ADD CONSTRAINT "prints_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "storypop"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storypop"."prints" ADD CONSTRAINT "prints_book_id_listings_id_fk" FOREIGN KEY ("book_id") REFERENCES "storypop"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_costs_day_agent_idx" ON "storypop"."agent_costs" USING btree ("date","agent");--> statement-breakpoint
CREATE INDEX "book_pages_book_idx" ON "storypop"."book_pages" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "conversions_event_idx" ON "storypop"."conversions" USING btree ("event");--> statement-breakpoint
CREATE INDEX "conversions_created_at_idx" ON "storypop"."conversions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "listings_qualified_idx" ON "storypop"."listings" USING btree ("qualified");--> statement-breakpoint
CREATE INDEX "listings_email_idx" ON "storypop"."listings" USING btree ("primary_contact_email");--> statement-breakpoint
CREATE INDEX "listings_photo_expires_idx" ON "storypop"."listings" USING btree ("photo_expires_at");--> statement-breakpoint
CREATE INDEX "listings_created_at_idx" ON "storypop"."listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_listing_idx" ON "storypop"."messages" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "messages_order_idx" ON "storypop"."messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_listing_idx" ON "storypop"."orders" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "storypop"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_listing_idx" ON "storypop"."outreach_events" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "outreach_resend_idx" ON "storypop"."outreach_events" USING btree ("resend_id");--> statement-breakpoint
CREATE INDEX "outreach_status_idx" ON "storypop"."outreach_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "previews_listing_idx" ON "storypop"."previews" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "prints_order_idx" ON "storypop"."prints" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "prints_lulu_status_idx" ON "storypop"."prints" USING btree ("lulu_status");