CREATE TABLE "sitebeat"."x_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_tweet_id" text NOT NULL,
	"author_id" text,
	"author_username" text,
	"text" text,
	"created_at_x" timestamp with time zone,
	"decision" text NOT NULL,
	"reasoning" text,
	"reply_tweet_id" text,
	"reply_text" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x_mentions_mention_tweet_id_uniq" UNIQUE("mention_tweet_id")
);
--> statement-breakpoint
ALTER TABLE "sitebeat"."admin_settings" ADD COLUMN "x_user_id" text;--> statement-breakpoint
ALTER TABLE "sitebeat"."admin_settings" ADD COLUMN "x_mentions_since_id" text;--> statement-breakpoint
CREATE INDEX "x_mentions_decision_idx" ON "sitebeat"."x_mentions" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "x_mentions_processed_at_idx" ON "sitebeat"."x_mentions" USING btree ("processed_at");