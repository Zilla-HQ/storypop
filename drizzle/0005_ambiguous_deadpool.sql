ALTER TABLE "sitebeat"."inbound_emails" ADD COLUMN "direction" text DEFAULT 'inbound' NOT NULL;--> statement-breakpoint
ALTER TABLE "sitebeat"."inbound_emails" ADD COLUMN "tag" text;--> statement-breakpoint
CREATE INDEX "inbound_emails_to_idx" ON "sitebeat"."inbound_emails" USING btree ("to_address");--> statement-breakpoint
CREATE INDEX "inbound_emails_direction_idx" ON "sitebeat"."inbound_emails" USING btree ("direction");