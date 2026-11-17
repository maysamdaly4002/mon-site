-- Snapify
-- © 2026 NOVALABS WEB DESIGN — Tunisie
-- Contact : contact@novalabs.tn · +216 24 734 647
CREATE TABLE IF NOT EXISTS "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"manifest" jsonb NOT NULL,
	"signature" jsonb,
	"license" jsonb,
	"settings" jsonb NOT NULL,
	"source" text NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "module_storage" (
	"module_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_storage_module_id_key_pk" PRIMARY KEY("module_id","key")
);
