CREATE INDEX "click_aff_idx" ON "clicks" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "comm_order_idx" ON "commissions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "comm_payout_idx" ON "commissions" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "comm_approvable_idx" ON "commissions" USING btree ("approvable_at");--> statement-breakpoint
CREATE INDEX "dc_aff_idx" ON "discount_codes" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "pi_payout_idx" ON "payout_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "pi_aff_idx" ON "payout_items" USING btree ("affiliate_id");