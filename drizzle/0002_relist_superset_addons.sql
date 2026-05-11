ALTER TABLE "relist"."listings" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "relist"."orders" ADD COLUMN "referral_code" text;--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "relist"."listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_referral_code_idx" ON "relist"."orders" USING btree ("referral_code");