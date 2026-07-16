CREATE TYPE "public"."payout_method" AS ENUM('paypal', 'venmo');--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "payout_method" "payout_method" DEFAULT 'venmo' NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "phone_verified_at" timestamp;--> statement-breakpoint
CREATE INDEX "phone_verif_idx" ON "phone_verifications" USING btree ("phone");