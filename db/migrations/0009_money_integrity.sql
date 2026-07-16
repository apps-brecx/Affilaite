DROP INDEX "wh_dedupe_idx";--> statement-breakpoint
ALTER TABLE "payout_items" ADD COLUMN "currency" text DEFAULT 'USD';--> statement-breakpoint
CREATE UNIQUE INDEX "comm_order_positive_uniq" ON "commissions" USING btree ("order_id") WHERE "commissions"."amount" >= 0;--> statement-breakpoint
CREATE UNIQUE INDEX "wh_dedupe_idx" ON "webhook_events" USING btree ("source","external_id");