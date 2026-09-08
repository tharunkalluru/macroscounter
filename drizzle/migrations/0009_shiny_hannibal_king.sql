CREATE TABLE "sync_tombstones" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"table_name" text NOT NULL,
	"client_id" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_tombstones_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "scanned_products" DROP CONSTRAINT "scanned_products_pkey";--> statement-breakpoint
ALTER TABLE "scanned_products" ADD CONSTRAINT "scanned_products_user_id_id_pk" PRIMARY KEY("user_id","id");--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_templates" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scanned_products" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "weigh_ins" ADD COLUMN "server_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_tombstones" ADD CONSTRAINT "sync_tombstones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_tombstones_user_sync_idx" ON "sync_tombstones" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "log_entries_user_sync_idx" ON "log_entries" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "log_entries_user_date_idx" ON "log_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "meal_templates_user_sync_idx" ON "meal_templates" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "profiles_user_sync_idx" ON "profiles" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "recipes_user_sync_idx" ON "recipes" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "scanned_products_user_sync_idx" ON "scanned_products" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "targets_user_sync_idx" ON "targets" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "weigh_ins_user_sync_idx" ON "weigh_ins" USING btree ("user_id","server_changed_at","id");--> statement-breakpoint
CREATE INDEX "weigh_ins_user_date_idx" ON "weigh_ins" USING btree ("user_id","date");