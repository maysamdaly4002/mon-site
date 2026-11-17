-- Snapify
-- © 2026 NOVALABS WEB DESIGN — Tunisie
-- Contact : contact@novalabs.tn · +216 24 734 647
-- Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
-- Menus : identifiants libres (suppression d'éventuelles contraintes CHECK héritées).
ALTER TABLE "menus" DROP CONSTRAINT IF EXISTS "menus_id_check";
--> statement-breakpoint
-- Articles : statut « scheduled » et date de publication planifiée.
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_status_check";
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_status_check" CHECK ("status" IN ('draft', 'published', 'scheduled'));
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
