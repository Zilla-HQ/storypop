CREATE TYPE "sitebeat"."partner_outreach_status" AS ENUM('queued', 'sent', 'replied', 'interested', 'joined', 'passed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "sitebeat"."partner_outreach" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"company" text,
	"notes" text,
	"status" "sitebeat"."partner_outreach_status" DEFAULT 'queued' NOT NULL,
	"first_sent_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"send_count" integer DEFAULT 0 NOT NULL,
	"last_outbound_message_id" text,
	"last_replied_at" timestamp with time zone,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_outreach_email_uniq" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "partner_outreach_status_idx" ON "sitebeat"."partner_outreach" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partner_outreach_last_replied_idx" ON "sitebeat"."partner_outreach" USING btree ("last_replied_at");