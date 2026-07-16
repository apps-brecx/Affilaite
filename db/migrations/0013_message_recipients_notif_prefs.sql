ALTER TABLE "affiliates" ADD COLUMN "notification_prefs" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "recipient_count" integer DEFAULT 0;