ALTER TABLE "sa_tickets" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sa_tickets_user_idx" ON "sa_tickets" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"market" text DEFAULT 'tn' NOT NULL,
	"country" text DEFAULT 'TN' NOT NULL,
	"status" text DEFAULT 'lead' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"license_order_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_profiles_email_uq" ON "client_profiles" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_profiles_status_idx" ON "client_profiles" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_profiles_user_idx" ON "client_profiles" USING btree ("platform_user_id");
