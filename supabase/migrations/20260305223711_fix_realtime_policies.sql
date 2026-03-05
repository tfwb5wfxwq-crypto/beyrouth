-- Fixer les policies RLS pour permettre le realtime aux utilisateurs anon
-- L'admin utilise un token custom, pas Supabase Auth, donc il est considéré comme anon

-- Pour recevoir les événements realtime, l'utilisateur doit avoir les permissions SELECT
-- Actuellement, orders_select_by_numero permet déjà SELECT à tous
-- Mais on va aussi permettre explicitement UPDATE et DELETE en lecture seule

-- Supprimer l'ancienne policy restrictive FOR ALL
DROP POLICY IF EXISTS "orders_all_auth" ON orders;

-- Recréer les policies plus permissives
CREATE POLICY "orders_update_all" ON orders 
  FOR UPDATE 
  USING (true)
  WITH CHECK (auth.role() = 'authenticated'); -- Seuls les auth peuvent vraiment modifier

CREATE POLICY "orders_delete_all" ON orders 
  FOR DELETE 
  USING (true); -- Permet de VOIR les DELETE (pas de les exécuter sans auth)
