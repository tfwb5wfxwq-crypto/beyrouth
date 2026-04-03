-- Migration: Bloquer le SELECT anon direct sur orders
-- La page confirmation.html utilise désormais l'Edge Function get-order-status
-- qui utilise service_role pour accéder aux données (bypass RLS)
-- Le client ne peut plus lister les commandes des autres clients

DROP POLICY IF EXISTS "orders_select_by_numero" ON orders;

-- Seul l'admin authentifié peut SELECT directement sur orders
-- Les Edge Functions utilisent service_role → bypass RLS automatique
CREATE POLICY "orders_select_auth" ON orders
  FOR SELECT
  USING (auth.role() = 'authenticated');
