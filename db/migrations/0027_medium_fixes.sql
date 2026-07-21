DROP INDEX "aff_ref_idx";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_subtotal" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "aff_user_idx" ON "affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "aff_status_idx" ON "affiliates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aff_program_idx" ON "affiliates" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "aff_group_idx" ON "affiliates" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "aff_shopify_customer_idx" ON "affiliates" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "orders_customer_email_idx" ON "orders" USING btree ("customer_email");