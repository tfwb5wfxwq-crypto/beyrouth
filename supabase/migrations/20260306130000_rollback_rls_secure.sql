-- Migration: Rollback RLS - Remettre policies restrictives
-- Maintenant que l'admin utilise Edge Functions sécurisées,
-- on peut bloquer les UPDATE directs pour anon

-- Supprimer TOUTES les policies existantes
DROP POLICY IF EXISTS "menu_items_update_all" ON menu_items;
DROP POLICY IF EXISTS "menu_items_insert_auth" ON menu_items;
DROP POLICY IF EXISTS "menu_items_delete_auth" ON menu_items;
DROP POLICY IF EXISTS "menu_items_all_auth" ON menu_items;

DROP POLICY IF EXISTS "ingredients_update_all" ON ingredients;
DROP POLICY IF EXISTS "ingredients_insert_auth" ON ingredients;
DROP POLICY IF EXISTS "ingredients_delete_auth" ON ingredients;
DROP POLICY IF EXISTS "ingredients_all_auth" ON ingredients;

-- Recréer la policy restrictive (seulement authenticated)
CREATE POLICY "menu_items_all_auth" ON menu_items
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ingredients_all_auth" ON ingredients
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON POLICY "menu_items_all_auth" ON menu_items IS 'Seuls les authenticated peuvent modifier. Admin utilise Edge Functions sécurisées.';
COMMENT ON POLICY "ingredients_all_auth" ON ingredients IS 'Seuls les authenticated peuvent modifier. Admin utilise Edge Functions sécurisées.';
