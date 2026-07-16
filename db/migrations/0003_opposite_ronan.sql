CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('affiliate', 'referral');--> statement-breakpoint
CREATE TABLE "affiliate_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "campaign_type" DEFAULT 'affiliate' NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"code_prefix" text,
	"reward_type" "commission_type" DEFAULT 'percent',
	"reward_value" numeric(8, 2),
	"friend_reward_type" "commission_type" DEFAULT 'percent',
	"friend_reward_value" numeric(8, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "affiliate_campaigns" ADD CONSTRAINT "affiliate_campaigns_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_campaigns" ADD CONSTRAINT "affiliate_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aff_camp_idx" ON "affiliate_campaigns" USING btree ("affiliate_id","campaign_id");