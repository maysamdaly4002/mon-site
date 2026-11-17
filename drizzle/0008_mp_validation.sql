ALTER TABLE "mp_versions" ADD COLUMN IF NOT EXISTS "validation_report" jsonb;
--> statement-breakpoint
ALTER TABLE "mp_versions" ADD COLUMN IF NOT EXISTS "module_id" text;
