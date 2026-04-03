-- Migration: Supprimer les anciennes policies qui overridaient la sécurité
-- Date: 2026-04-03 (correctif)

-- ============================================
-- SETTINGS : Supprimer les vieilles policies permissives
-- ============================================
DROP POLICY IF EXISTS "Allow public read" ON settings;
DROP POLICY IF EXISTS "Allow authenticated update" ON settings;
DROP POLICY IF EXISTS "Allow anon read" ON settings;
DROP POLICY IF EXISTS "Allow all" ON settings;

-- ============================================
-- CLIENTS : Restreindre UPDATE à authenticated seulement
-- ============================================
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_select_anon" ON clients;

-- Seul l'admin peut mettre à jour les clients
CREATE POLICY "clients_update_auth" ON clients
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- ORDERS : S'assurer que orders_select_by_numero
-- ne permet pas de tout lister (uniquement récentes via fenêtre 2h)
-- ============================================
-- La policy orders_select_by_numero mise à jour dans la migration précédente
-- devrait déjà restreindre aux commandes récentes (<2h) pour les anon.
-- Vérification: aucune autre policy SELECT permissive ne doit exister.
DROP POLICY IF EXISTS "Allow anon read orders" ON orders;
DROP POLICY IF EXISTS "Allow public read orders" ON orders;
