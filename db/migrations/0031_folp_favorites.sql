ALTER TABLE "affiliates" ADD COLUMN "favorite_collection_id" text;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "favorite_collection_handle" text;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "favorite_product_ids" jsonb;