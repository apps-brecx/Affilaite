CREATE TYPE "public"."campaign_access" AS ENUM('instant', 'approval', 'invite');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "access" "campaign_access" DEFAULT 'approval' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "destination_url" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_slug_unique" UNIQUE("slug");