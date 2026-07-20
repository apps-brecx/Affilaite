CREATE TABLE "discovered_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"media_type" text DEFAULT 'post' NOT NULL,
	"caption" text,
	"description" text,
	"posted_at" timestamp,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "discovered_posts" ADD CONSTRAINT "discovered_posts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disc_aff_idx" ON "discovered_posts" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disc_dedupe_idx" ON "discovered_posts" USING btree ("affiliate_id","platform","external_id");
