-- Migration: Restreindre UPDATE et DELETE sur orders à authenticated
-- Date: 2026-04-03
-- Problème: orders_delete_all et orders_update_all avaient USING (true)
-- → n'importe qui pouvait modifier ou supprimer des commandes

DROP POLICY IF EXISTS "orders_delete_all" ON orders;
DROP POLICY IF EXISTS "orders_update_all" ON orders;
DROP POLICY IF EXISTS "orders_all_auth" ON orders;

-- UPDATE et DELETE : uniquement admin authentifié
-- (les Edge Functions paygreen-webhook / edenred-oauth-callback utilisent service_role → bypass RLS)
CREATE POLICY "orders_update_auth" ON orders
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "orders_delete_auth" ON orders
  FOR DELETE
  USING (auth.role() = 'authenticated');
