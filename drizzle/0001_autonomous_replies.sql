CREATE TABLE "sitebeat"."inbound_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text,
	"text" text,
	"html" text,
	"message_id" text,
	"in_reply_to" text,
	"raw_payload" jsonb,
	"action" text DEFAULT 'stored' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_emails_message_id_uniq" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "sitebeat"."admin_settings" ALTER COLUMN "discovery_paused" SET DEFAULT false;--> statement-breakpoint
-- Flip the existing single-row config to match the new default. Sitebeat
-- is now an autonomous outbound funnel; toggle off via /admin/settings.
UPDATE "sitebeat"."admin_settings" SET "discovery_paused" = false WHERE "id" = 1;--> statement-breakpoint
CREATE INDEX "inbound_emails_from_idx" ON "sitebeat"."inbound_emails" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "inbound_emails_created_at_idx" ON "sitebeat"."inbound_emails" USING btree ("created_at");