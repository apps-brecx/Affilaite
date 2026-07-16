CREATE TABLE "group_message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "group_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"sender_id" uuid,
	"body" text,
	"attachments" jsonb,
	"poll" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"option_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "group_message_reads" ADD CONSTRAINT "group_message_reads_message_id_group_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."group_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message_reads" ADD CONSTRAINT "group_message_reads_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_message_id_group_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."group_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gmr_msg_idx" ON "group_message_reads" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gmr_msg_aff_uniq" ON "group_message_reads" USING btree ("message_id","affiliate_id");--> statement-breakpoint
CREATE INDEX "gm_group_idx" ON "group_messages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "pv_msg_idx" ON "poll_votes" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pv_msg_aff_uniq" ON "poll_votes" USING btree ("message_id","affiliate_id");