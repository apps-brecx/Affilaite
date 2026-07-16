ALTER TABLE "affiliates" ADD COLUMN "samples_banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sample_requests" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "sample_requests" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "sample_requests" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "sample_requests" ADD COLUMN "shipped_at" timestamp;