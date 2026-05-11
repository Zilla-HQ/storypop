CREATE SCHEMA "sitebeat";
--> statement-breakpoint
CREATE TYPE "sitebeat"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TABLE "sitebeat"."admin_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"monitoring_paused" boolean DEFAULT false NOT NULL,
	"discovery_paused" boolean DEFAULT true NOT NULL,
	"sender_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_blacklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitebeat"."agent_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"agent" text NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitebeat"."audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"score" integer,
	"ttfb_ms" integer,
	"report" jsonb,
	"error_message" text,
	"run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitebeat"."sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_url" text NOT NULL,
	"customer_email" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_audit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_site_url_uniq" UNIQUE("site_url")
);
--> statement-breakpoint
CREATE TABLE "sitebeat"."subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"customer_email" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" "sitebeat"."subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	CONSTRAINT "subscriptions_stripe_sub_uniq" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "sitebeat"."audits" ADD CONSTRAINT "audits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "sitebeat"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitebeat"."subscriptions" ADD CONSTRAINT "subscriptions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "sitebeat"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_costs_day_agent_idx" ON "sitebeat"."agent_costs" USING btree ("date","agent");--> statement-breakpoint
CREATE INDEX "audits_site_idx" ON "sitebeat"."audits" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "audits_run_at_idx" ON "sitebeat"."audits" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "sites_customer_email_idx" ON "sitebeat"."sites" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "sites_last_audit_at_idx" ON "sitebeat"."sites" USING btree ("last_audit_at");--> statement-breakpoint
CREATE INDEX "subscriptions_site_idx" ON "sitebeat"."subscriptions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "sitebeat"."subscriptions" USING btree ("status");