CREATE UNIQUE INDEX "comm_order_unique" ON "commissions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "comm_payout_idx" ON "commissions" USING btree ("payout_id");