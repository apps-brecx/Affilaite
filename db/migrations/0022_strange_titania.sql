CREATE TYPE "public"."group_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"from_admin" boolean DEFAULT true NOT NULL,
	"sender_id" uuid,
	"body" text,
	"attachments" jsonb,
	"kind" text DEFAULT 'text' NOT NULL,
	"payload" jsonb,
	"read_by_admin_at" timestamp,
	"read_by_affiliate_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "kind" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "avatar_emoji" text DEFAULT '💬';--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "avatar_color" text DEFAULT 'emerald';--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "visibility" "group_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "is_main" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dm_aff_idx" ON "direct_messages" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "gmem_group_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "gmem_aff_idx" ON "group_members" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gmem_group_aff_uniq" ON "group_members" USING btree ("group_id","affiliate_id");--> statement-breakpoint
-- Seed the main group (every partner belongs to it) if none exists yet.
INSERT INTO "groups" ("name", "description", "avatar_emoji", "avatar_color", "visibility", "is_main")
SELECT 'Everyone', 'The main channel — every partner is here.', '📣', 'emerald', 'public', true
WHERE NOT EXISTS (SELECT 1 FROM "groups" WHERE "is_main" = true);--> statement-breakpoint
-- Every affiliate is a member of the main group.
INSERT INTO "group_members" ("group_id", "affiliate_id")
SELECT g.id, a.id FROM "groups" g CROSS JOIN "affiliates" a WHERE g."is_main" = true
ON CONFLICT ("group_id","affiliate_id") DO NOTHING;--> statement-breakpoint
-- Backfill existing single-group memberships into the new join table.
INSERT INTO "group_members" ("group_id", "affiliate_id")
SELECT a."group_id", a."id" FROM "affiliates" a WHERE a."group_id" IS NOT NULL
ON CONFLICT ("group_id","affiliate_id") DO NOTHING;