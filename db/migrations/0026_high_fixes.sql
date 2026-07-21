ALTER TYPE "public"."payout_status" ADD VALUE 'partial' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dc_campaign_idx" ON "discount_codes" USING btree ("campaign_id");