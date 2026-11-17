-- Snapify
-- © 2026 NOVALABS WEB DESIGN — Tunisie
-- Contact : contact@novalabs.tn · +216 24 734 647
CREATE TABLE IF NOT EXISTS "module_records" (
	"module_id" text NOT NULL,
	"collection" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_records_module_id_collection_id_pk" PRIMARY KEY("module_id","collection","id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_records_created_idx" ON "module_records" USING btree ("module_id","collection","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_records_data_gin" ON "module_records" USING gin ("data" jsonb_path_ops);
