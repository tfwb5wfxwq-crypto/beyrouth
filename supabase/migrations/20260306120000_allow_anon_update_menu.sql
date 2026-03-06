-- Migration: Autoriser les UPDATE sur menu_items pour anon
-- L'admin utilise anon key et doit pouvoir désactiver les plats

-- Supprimer l'ancienne policy restrictive
DROP POLICY IF EXISTS "menu_items_all_auth" ON menu_items;

-- Recréer avec permission pour anon et authenticated
CREATE POLICY "menu_items_update_all" ON menu_items
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy pour INSERT/DELETE reste restrictive (seulement authenticated)
CREATE POLICY "menu_items_insert_auth" ON menu_items
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "menu_items_delete_auth" ON menu_items
  FOR DELETE
  USING (auth.role() = 'authenticated');

COMMENT ON POLICY "menu_items_update_all" ON menu_items IS 'Permet UPDATE pour tous (anon + authenticated) car admin utilise anon key';
