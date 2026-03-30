-- Fix RLS policy admin_sessions : autoriser service_role au lieu de bloquer tout

-- 1. Drop ancienne policy qui bloque tout
DROP POLICY IF EXISTS "service_role_only" ON admin_sessions;

-- 2. Créer nouvelle policy qui autorise uniquement service_role
CREATE POLICY "service_role_full_access" ON admin_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Note: RLS reste activé mais seules les Edge Functions (via service_role_key) peuvent accéder
