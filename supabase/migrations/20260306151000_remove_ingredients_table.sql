-- Migration: Supprimer table ingredients obsolète
-- Date: 6 mars 2026
-- Raison: Admin désactive maintenant des plats entiers, pas des ingrédients individuels

-- Supprimer la publication realtime (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ingredients'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE ingredients;
  END IF;
END $$;

-- Supprimer les policies RLS
DROP POLICY IF EXISTS "ingredients_select" ON ingredients;
DROP POLICY IF EXISTS "ingredients_all_auth" ON ingredients;

-- Supprimer la table
DROP TABLE IF EXISTS ingredients CASCADE;

-- Note: On garde la colonne ingredients dans menu_items pour afficher la liste descriptive
COMMENT ON COLUMN menu_items.ingredients IS 'Liste descriptive des ingrédients (info uniquement, pas de toggle)';
