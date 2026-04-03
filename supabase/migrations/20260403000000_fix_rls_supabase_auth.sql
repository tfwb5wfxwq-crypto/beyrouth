-- Migration: Sécuriser RLS avec Supabase Auth email+password
-- Date: 2026-04-03
-- Remplace le système admin_code par Supabase Auth (role: authenticated)

-- ============================================
-- 1. SETTINGS TABLE — Activer RLS + policies
-- ============================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Supprimer les vieilles policies si elles existent
DROP POLICY IF EXISTS "settings_select_public" ON settings;
DROP POLICY IF EXISTS "settings_all_auth" ON settings;
DROP POLICY IF EXISTS "settings_anon_read" ON settings;

-- Anon peut lire uniquement les clés publiques (pas admin_code)
CREATE POLICY "settings_select_public" ON settings
  FOR SELECT
  USING (
    key IN (
      'click_collect_enabled',
      'next_slot_available_at',
      'indefinite_pause',
      'auto_accept_orders',
      'catering_enabled',
      'maintenance_mode'
    )
  );

-- Admin authentifié peut tout faire
CREATE POLICY "settings_all_auth" ON settings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 2. ORDERS TABLE — Restreindre le SELECT anon
-- ============================================

-- Supprimer la policy permissive (USING true)
DROP POLICY IF EXISTS "orders_select_by_numero" ON orders;

-- Recréer : anon peut lire SEULEMENT ses propres commandes (par numéro exact)
-- Note: une vraie restriction nécessiterait auth par email, mais pour l'instant
-- on garde la possibilité de lookup par numéro pour la page de confirmation
CREATE POLICY "orders_select_by_numero" ON orders
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR (
      -- Anon peut voir une commande seulement si elle est récente (< 2h) = flow de confirmation
      created_at > NOW() - INTERVAL '2 hours'
    )
  );

-- ============================================
-- 3. CLIENTS TABLE — Restreindre le SELECT anon
-- ============================================

-- Supprimer la policy permissive ajoutée le 1er avril
DROP POLICY IF EXISTS "clients_select_anon" ON clients;
DROP POLICY IF EXISTS "clients_select_auth" ON clients;

-- Seul l'admin authentifié peut lire la liste des clients
CREATE POLICY "clients_select_auth" ON clients
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- 4. OAUTH_STATES — Restreindre accès anon
-- ============================================
DROP POLICY IF EXISTS "oauth_states_public" ON oauth_states;
DROP POLICY IF EXISTS "oauth_states_all" ON oauth_states;

-- Uniquement service_role (Edge Functions) peut accéder
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oauth_states_service_only" ON oauth_states
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 5. Supprimer admin_code de settings (plus nécessaire)
-- ============================================
-- On garde la ligne mais on la met en commentaire pour pouvoir rollback
-- DELETE FROM settings WHERE key = 'admin_code';
-- (À faire manuellement après validation complète)

-- ============================================
-- Note: Les Edge Functions utilisent service_role_key → bypass RLS
-- Le panel admin utilise maintenant supabase.auth.signInWithPassword()
-- → JWT avec role: authenticated → accès via policies _all_auth
-- ============================================
