ALTER TABLE "sitebeat"."subscriptions" ADD COLUMN "ref" text;--> statement-breakpoint
CREATE INDEX "subscriptions_ref_idx" ON "sitebeat"."subscriptions" USING btree ("ref");