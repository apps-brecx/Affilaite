CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"url" text NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_aff_idx" ON "posts" USING btree ("affiliate_id");--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_handle_unique" UNIQUE("handle");--> statement-breakpoint
-- Seed a default link-in-bio handle from each affiliate's ref code.
-- Only assign where the lowercased code is unique — collisions stay NULL so the
-- freshly-added UNIQUE(handle) constraint can never fail the deploy migration.
UPDATE "affiliates" a
SET "handle" = lower(a."ref_code")
WHERE a."handle" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "affiliates" b
    WHERE b."id" <> a."id" AND lower(b."ref_code") = lower(a."ref_code")
  );