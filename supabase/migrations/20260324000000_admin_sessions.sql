-- Migration: Système de sessions admin sécurisé
-- Date: 2026-03-24
-- Description: Stockage des tokens admin pour validation et audit

-- Table admin_sessions pour tracker les tokens valides
CREATE TABLE IF NOT EXISTS admin_sessions (
  token UUID PRIMARY KEY,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par expiration
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions(expires_at);

-- Index pour recherche par IP (audit)
CREATE INDEX IF NOT EXISTS idx_admin_sessions_ip
  ON admin_sessions(ip_address);

-- Fonction pour nettoyer automatiquement les sessions expirées
CREATE OR REPLACE FUNCTION clean_expired_admin_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM admin_sessions
  WHERE expires_at < NOW();
END;
$$;

-- RLS: Désactivé car utilisé uniquement avec service_role_key
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Seul le service_role peut accéder (via Edge Functions)
CREATE POLICY "service_role_only" ON admin_sessions
  FOR ALL
  USING (false); -- Bloque tout accès direct, force passage par Edge Functions

-- Commentaires
COMMENT ON TABLE admin_sessions IS 'Sessions admin actives avec validation et audit';
COMMENT ON COLUMN admin_sessions.token IS 'UUID généré par admin-auth, utilisé comme Bearer token';
COMMENT ON COLUMN admin_sessions.ip_address IS 'IP du client (X-Forwarded-For ou X-Real-IP)';
COMMENT ON COLUMN admin_sessions.user_agent IS 'User-Agent du navigateur pour identification appareil';
COMMENT ON COLUMN admin_sessions.created_at IS 'Date de création du token (login)';
COMMENT ON COLUMN admin_sessions.expires_at IS 'Date d''expiration (7 jours après création)';
COMMENT ON COLUMN admin_sessions.last_activity IS 'Dernière activité de la session (updated à chaque requête)';
