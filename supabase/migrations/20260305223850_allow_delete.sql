-- Permettre DELETE pour tout le monde (temporairement pour les tests)
DROP POLICY IF EXISTS "orders_delete_all" ON orders;

CREATE POLICY "orders_delete_all" ON orders 
  FOR DELETE 
  USING (true);
