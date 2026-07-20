ALTER TABLE "users" ADD COLUMN "is_owner" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
-- Every existing admin becomes an owner with full access, so nobody is locked
-- out when per-area permissions go live.
UPDATE "users" SET "is_owner" = true WHERE "role" = 'admin';
