ALTER TABLE "commissions" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comm_campaign_idx" ON "commissions" USING btree ("campaign_id");