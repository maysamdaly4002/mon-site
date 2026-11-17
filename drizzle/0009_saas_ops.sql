CREATE TABLE IF NOT EXISTS "sa_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'support' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"subject" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"email" text,
	"name" text,
	"ref_type" text,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sa_tickets_status_idx" ON "sa_tickets" USING btree ("status","kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sa_newsletter_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sa_newsletter_email_uq" ON "sa_newsletter_subscribers" USING btree ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sa_newsletter_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sa_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"amount_millimes" integer NOT NULL,
	"tax_millimes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sa_invoices_number_uq" ON "sa_invoices" USING btree ("number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sa_invoices_status_idx" ON "sa_invoices" USING btree ("status","kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sa_payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'flouci' NOT NULL,
	"kind" text NOT NULL,
	"amount_millimes" integer NOT NULL,
	"status" text NOT NULL,
	"tracking_id" text,
	"payment_id" text,
	"ref_type" text,
	"ref_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sa_payment_events_ref_idx" ON "sa_payment_events" USING btree ("ref_type","ref_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sa_payment_events_created_idx" ON "sa_payment_events" USING btree ("created_at");
