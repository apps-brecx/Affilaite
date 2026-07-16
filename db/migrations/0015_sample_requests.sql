CREATE TYPE "public"."sample_status" AS ENUM('requested', 'approved', 'rejected', 'shipped');--> statement-breakpoint
CREATE TABLE "sample_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"product_id" text,
	"product_title" text,
	"product_image" text,
	"product_url" text,
	"note" text,
	"address_snapshot" text,
	"status" "sample_status" DEFAULT 'requested' NOT NULL,
	"shopify_order_id" text,
	"admin_note" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sample_aff_idx" ON "sample_requests" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "sample_status_idx" ON "sample_requests" USING btree ("status");