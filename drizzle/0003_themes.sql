-- Snapify
-- © 2026 NOVALABS WEB DESIGN — Tunisie
-- Contact : contact@novalabs.tn · +216 24 734 647
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'module' NOT NULL;
