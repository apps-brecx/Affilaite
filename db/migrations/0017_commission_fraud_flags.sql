ALTER TABLE "commissions" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "flag_reason" text;