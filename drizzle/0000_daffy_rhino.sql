CREATE SCHEMA "relist";
--> statement-breakpoint
CREATE TYPE "relist"."listing_type" AS ENUM('single_family', 'condo', 'townhouse', 'multi_family', 'land', 'other');--> statement-breakpoint
CREATE TYPE "relist"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "relist"."order_status" AS ENUM('pending', 'paid', 'fulfilling', 'fulfilled', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "relist"."order_tier" AS ENUM('standard', 'premium', 'rush');--> statement-breakpoint
CREATE TYPE "relist"."outreach_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "relist"."outreach_status" AS ENUM('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'replied', 'unsubscribed', 'failed');--> statement-breakpoint
CREATE TYPE "relist"."listing_source" AS ENUM('zillow', 'redfin', 'realtor');--> statement-breakpoint
CREATE TABLE "relist"."admin_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pricing_standard_cents" integer DEFAULT 7900 NOT NULL,
	"pricing_premium_cents" integer DEFAULT 14900 NOT NULL,
	"pricing_rush_cents" integer DEFAULT 19900 NOT NULL,
	"daily_send_cap" integer DEFAULT 500 NOT NULL,
	"preview_daily_cap" integer DEFAULT 500 NOT NULL,
	"fulfillment_daily_budget_cents" integer DEFAULT 100000 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"discovery_paused" boolean DEFAULT false NOT NULL,
	"qualification_paused" boolean DEFAULT false NOT NULL,
	"preview_paused" boolean DEFAULT false NOT NULL,
	"outreach_paused" boolean DEFAULT false NOT NULL,
	"fulfillment_paused" boolean DEFAULT false NOT NULL,
	"followup_paused" boolean DEFAULT false NOT NULL,
	"style_presets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sender_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brokerage_blacklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_blacklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relist"."agent_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"agent" text NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relist"."listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "relist"."listing_source" NOT NULL,
	"source_id" text NOT NULL,
	"mls_id" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"price" integer NOT NULL,
	"dom" integer,
	"listing_type" "relist"."listing_type" DEFAULT 'single_family',
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agent_name" text,
	"agent_email" text,
	"agent_phone" text,
	"brokerage" text,
	"photo_score" double precision,
	"agent_value_score" double precision,
	"target_score" double precision,
	"qualified" boolean DEFAULT false NOT NULL,
	"qualification_reason" text,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_source_source_id_uniq" UNIQUE("source","source_id"),
	CONSTRAINT "listings_slug_uniq" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "relist"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"listing_id" uuid NOT NULL,
	"direction" "relist"."message_direction" NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"message_id_header" text,
	"in_reply_to" text,
	"ai_reply_generated" boolean DEFAULT false NOT NULL,
	"human_flag" boolean DEFAULT false NOT NULL,
	"classification" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relist"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"tier" "relist"."order_tier" DEFAULT 'standard' NOT NULL,
	"style_preset" text DEFAULT 'modern' NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"status" "relist"."order_status" DEFAULT 'pending' NOT NULL,
	"fulfillment_job_id" text,
	"delivery_url" text,
	"zip_url" text,
	"customer_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	CONSTRAINT "orders_stripe_session_uniq" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "relist"."outreach_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"channel" "relist"."outreach_channel" NOT NULL,
	"template_id" text NOT NULL,
	"sender_domain" text,
	"subject" text,
	"body" text,
	"resend_id" text,
	"twilio_sid" text,
	"status" "relist"."outreach_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"first_opened_at" timestamp with time zone,
	"first_clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relist"."previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"original_photo_urls" jsonb NOT NULL,
	"enhanced_photo_urls" jsonb NOT NULL,
	"style_preset" text NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relist"."messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "relist"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relist"."messages" ADD CONSTRAINT "messages_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "relist"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relist"."orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "relist"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relist"."outreach_events" ADD CONSTRAINT "outreach_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "relist"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relist"."previews" ADD CONSTRAINT "previews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "relist"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_costs_day_agent_idx" ON "relist"."agent_costs" USING btree ("date","agent");--> statement-breakpoint
CREATE INDEX "listings_qualified_idx" ON "relist"."listings" USING btree ("qualified");--> statement-breakpoint
CREATE INDEX "listings_agent_email_idx" ON "relist"."listings" USING btree ("agent_email");--> statement-breakpoint
CREATE INDEX "listings_created_at_idx" ON "relist"."listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_listing_idx" ON "relist"."messages" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "messages_order_idx" ON "relist"."messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_listing_idx" ON "relist"."orders" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "relist"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_listing_idx" ON "relist"."outreach_events" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "outreach_resend_idx" ON "relist"."outreach_events" USING btree ("resend_id");--> statement-breakpoint
CREATE INDEX "outreach_status_idx" ON "relist"."outreach_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_sent_at_idx" ON "relist"."outreach_events" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "previews_listing_idx" ON "relist"."previews" USING btree ("listing_id");