ALTER TYPE "relist"."listing_source" ADD VALUE 'homeowner_self_serve';--> statement-breakpoint
ALTER TYPE "relist"."listing_source" ADD VALUE 'attom';--> statement-breakpoint
ALTER TYPE "relist"."listing_source" ADD VALUE 'propertyradar';--> statement-breakpoint
CREATE TABLE "relist"."campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text DEFAULT 'meta' NOT NULL,
	"meta_campaign_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_meta_campaign_id_uniq" UNIQUE("meta_campaign_id")
);
--> statement-breakpoint
CREATE TABLE "relist"."contractor_intros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"contractor_name" text NOT NULL,
	"contractor_phone" text,
	"contractor_url" text,
	"contractor_address" text,
	"contractor_email" text,
	"contractor_website" text,
	"email_source" text,
	"rating" double precision,
	"review_count" integer,
	"yelp_id" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relist"."contractor_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"service_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"budget_band" text,
	"timeline" text,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relist"."x_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_tweet_id" text NOT NULL,
	"author_id" text NOT NULL,
	"author_username" text,
	"text" text NOT NULL,
	"created_at_x" timestamp with time zone,
	"decision" text NOT NULL,
	"reasoning" text NOT NULL,
	"reply_tweet_id" text,
	"reply_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x_mentions_mention_tweet_id_unique" UNIQUE("mention_tweet_id")
);
--> statement-breakpoint
ALTER TABLE "relist"."admin_settings" ADD COLUMN "mailer_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "relist"."admin_settings" ADD COLUMN "x_refresh_token" text;--> statement-breakpoint
ALTER TABLE "relist"."admin_settings" ADD COLUMN "x_user_id" text;--> statement-breakpoint
ALTER TABLE "relist"."admin_settings" ADD COLUMN "x_username" text;--> statement-breakpoint
ALTER TABLE "relist"."admin_settings" ADD COLUMN "x_mentions_since_id" text;--> statement-breakpoint
ALTER TABLE "relist"."listings" ADD COLUMN "floorplan_recommendations" jsonb;--> statement-breakpoint
ALTER TABLE "relist"."listings" ADD COLUMN "floorplan_source_url" text;--> statement-breakpoint
ALTER TABLE "relist"."previews" ADD COLUMN "service_id" text DEFAULT 'photo-staging' NOT NULL;--> statement-breakpoint
ALTER TABLE "relist"."contractor_intros" ADD CONSTRAINT "contractor_intros_lead_id_contractor_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "relist"."contractor_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relist"."contractor_leads" ADD CONSTRAINT "contractor_leads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "relist"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_platform_idx" ON "relist"."campaigns" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "relist"."campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractor_intros_lead_idx" ON "relist"."contractor_intros" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "contractor_intros_status_idx" ON "relist"."contractor_intros" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractor_leads_listing_idx" ON "relist"."contractor_leads" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "contractor_leads_status_idx" ON "relist"."contractor_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "x_mentions_decision_idx" ON "relist"."x_mentions" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "x_mentions_created_at_idx" ON "relist"."x_mentions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "previews_service_idx" ON "relist"."previews" USING btree ("service_id");